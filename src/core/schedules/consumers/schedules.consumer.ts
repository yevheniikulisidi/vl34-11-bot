import { InjectRedis } from '@nestjs-modules/ioredis';
import { Processor, OnQueueFailed, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { chain, isEqual } from 'lodash';
import { NzService } from 'src/integrations/nz/nz.service';
import { Schedule } from '../interfaces/schedule.interface';
import { SchedulesService } from '../schedules.service';

@Processor('schedules')
export class SchedulesConsumer {
  private readonly logger = new Logger(SchedulesConsumer.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly nzService: NzService,
    private readonly schedulesService: SchedulesService,
  ) {}

  @OnQueueFailed()
  async onQueueFailed(_job: Job, err: Error) {
    this.logger.error(err);
  }

  @Process()
  async handleJob(job: Job<{ class: '11a' | '11b' }>) {
    try {
      const [cachedBoyAccessToken, cachedGirlAccessToken] = await Promise.all([
        this.redis.get(`${job.data.class}:access-token:boy`),
        this.redis.get(`${job.data.class}:access-token:girl`),
      ]);

      if (!cachedBoyAccessToken || !cachedGirlAccessToken) {
        const classConfig = this.getClassConfig(job.data.class);
        const [
          { access_token: boyAccessToken },
          { access_token: girlAccessToken },
        ] = await Promise.all([
          this.nzService.login(
            classConfig.boy.username,
            classConfig.boy.password,
          ),
          this.nzService.login(
            classConfig.girl.username,
            classConfig.girl.password,
          ),
        ]);

        await Promise.all([
          this.redis.set(`${job.data.class}:access-token:boy`, boyAccessToken),
          this.redis.set(
            `${job.data.class}:access-token:girl`,
            girlAccessToken,
          ),
        ]);

        await this.scheduleAndCacheLessons(
          job.data.class,
          boyAccessToken,
          girlAccessToken,
        );
      } else {
        await this.scheduleAndCacheLessons(
          job.data.class,
          cachedBoyAccessToken,
          cachedGirlAccessToken,
        );
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  private getClassConfig(_class: '11a' | '11b'): {
    boy: { username: string; password: string };
    girl: { username: string; password: string };
  } {
    const getConfig = (role: string) => ({
      username: this.configService.getOrThrow<string>(
        `NZ_${_class.toUpperCase()}_${role}_USERNAME`,
      ),
      password: this.configService.getOrThrow<string>(
        `NZ_${_class.toUpperCase()}_${role}_PASSWORD`,
      ),
    });

    return {
      boy: getConfig('BOY'),
      girl: getConfig('GIRL'),
    };
  }

  private async scheduleAndCacheLessons(
    _class: '11a' | '11b',
    boyAccessToken: string,
    girlAccessToken: string,
  ): Promise<void> {
    const now = dayjs().tz('Europe/Kyiv').locale('uk', { weekStart: 1 });

    const startOfWeek = now.startOf('week').format('YYYY-MM-DD');
    const endOfWeek = now.endOf('week').format('YYYY-MM-DD');

    const [boySchedule, girlSchedule] = await Promise.all([
      this.schedulesService.schedule(boyAccessToken, startOfWeek, endOfWeek),
      this.schedulesService.schedule(girlAccessToken, startOfWeek, endOfWeek),
    ]);

    const schedule = this.mergeSchedules(boySchedule, girlSchedule);

    await this.cacheSchedule(_class, schedule, 7 * 24 * 60 * 60);

    if (now.day() === 0) {
      const [boySchedule2, girlSchedule2] = await Promise.all([
        this.schedulesService.schedule(boyAccessToken, startOfWeek, endOfWeek),
        this.schedulesService.schedule(girlAccessToken, startOfWeek, endOfWeek),
      ]);

      const schedule2 = this.mergeSchedules(boySchedule2, girlSchedule2);

      await this.cacheSchedule(_class, schedule2, 7 * 24 * 60 * 60);
    }
  }

  private mergeSchedules(...schedules: Schedule[]): Schedule {
    return {
      dates: chain(schedules.map((s) => s.dates))
        .flatten()
        .groupBy('date')
        .map((lessons, date) => ({
          date,
          lessons: chain(lessons)
            .flatMap('lessons')
            .groupBy('number')
            .map((lessonGroup) => ({
              number: lessonGroup[0].number,
              startTime: lessonGroup[0].startTime,
              endTime: lessonGroup[0].endTime,
              subjects: chain(lessonGroup)
                .flatMap('subjects')
                .uniqWith(isEqual)
                .value(),
            }))
            .value(),
        }))
        .value(),
    };
  }

  private async cacheSchedule(
    _class: '11a' | '11b',
    schedule: Schedule,
    expirationSeconds: number,
  ): Promise<void> {
    for (const scheduleDate of schedule.dates) {
      await this.redis.set(
        `${_class}:schedule:${scheduleDate.date}`,
        JSON.stringify(scheduleDate.lessons),
        'EX',
        expirationSeconds,
      );
    }

    const now = dayjs().toISOString();

    await this.redis.set(`${_class}:updated-at`, now);
  }
}
