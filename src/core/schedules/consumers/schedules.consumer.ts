import { InjectRedis } from '@nestjs-modules/ioredis';
import { Processor, InjectQueue, OnQueueFailed, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bull';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { chain, isEqual } from 'lodash';
import { SettingsRepository } from 'src/core/settings/repositories/settings.repository';
import { UsersRepository } from 'src/core/users/repositories/users.repository';
import { NzService } from 'src/integrations/nz/nz.service';
import { LessonUpdates } from '../interfaces/lesson-updates.interface';
import { Schedule, ScheduleLesson } from '../interfaces/schedule.interface';
import { SchedulesService } from '../schedules.service';

@Processor('schedules')
export class SchedulesConsumer {
  private readonly logger = new Logger(SchedulesConsumer.name);

  constructor(
    @InjectQueue('message-distribution')
    private readonly messageDistributionQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly nzService: NzService,
    private readonly schedulesService: SchedulesService,
    private readonly settingsRepository: SettingsRepository,
    private readonly usersRepository: UsersRepository,
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

    const settings = await this.settingsRepository.findSettings();
    const { isDistanceEducation } =
      settings || (await this.settingsRepository.createSettings());

    if (isDistanceEducation) {
      const todayDate = now.format('YYYY-MM-DD');

      const oldTodayScheduleLessons = await this.schedulesService.getSchedule(
        _class,
        todayDate,
      );

      const newTodayScheduleLessons = schedule.dates.find(
        (date) => date.date === todayDate,
      );

      if (newTodayScheduleLessons) {
        const lessonUpdates = this.compareScheduleLessons(
          oldTodayScheduleLessons,
          newTodayScheduleLessons.lessons,
        );

        if (lessonUpdates.length > 0) {
          const scheduleClass = _class === '11a' ? 'CLASS_11A' : 'CLASS_11B';
          const users =
            await this.usersRepository.findUsersNotifyingLessonUpdates(
              scheduleClass,
            );

          await this.messageDistributionQueue.addBulk(
            users.map((user) => ({
              data: { userId: user.id.toString(), lessonUpdates },
              name: 'lesson-updates',
            })),
          );
        }
      }
    }

    await this.cacheSchedule(_class, schedule, 7 * 24 * 60 * 60);

    if (now.day() === 0) {
      const startOfNextWeek = now
        .add(1, 'week')
        .startOf('week')
        .format('YYYY-MM-DD');
      const endOfNextWeek = now
        .add(1, 'week')
        .endOf('week')
        .format('YYYY-MM-DD');

      const [boySchedule2, girlSchedule2] = await Promise.all([
        this.schedulesService.schedule(
          boyAccessToken,
          startOfNextWeek,
          endOfNextWeek,
        ),
        this.schedulesService.schedule(
          girlAccessToken,
          startOfNextWeek,
          endOfNextWeek,
        ),
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

  private compareScheduleLessons(
    oldScheduleLessons: ScheduleLesson[],
    newScheduleLessons: ScheduleLesson[],
  ): LessonUpdates[] {
    const updates: LessonUpdates[] = [];

    for (const newLesson of newScheduleLessons) {
      const oldLesson = oldScheduleLessons.find(
        (l) => l.number === newLesson.number,
      );

      if (!oldLesson) {
        updates.push({
          type: 'addedLesson',
          number: newLesson.number,
          subjects: newLesson.subjects,
        });
      } else {
        for (const newSubject of newLesson.subjects) {
          const oldSubject = oldLesson.subjects.find(
            (s) => s.name === newSubject.name,
          );

          if (!oldSubject) {
            updates.push({
              type: 'addedSubject',
              number: newLesson.number,
              subjects: [newSubject],
            });
          } else {
            if (
              oldSubject.meetingUrl === null &&
              newSubject.meetingUrl !== null
            ) {
              updates.push({
                type: 'addedMeetingUrl',
                number: newLesson.number,
                subjects: [newSubject],
              });
            } else if (oldSubject.meetingUrl !== newSubject.meetingUrl) {
              updates.push({
                type: 'removedMeetingUrl',
                number: newLesson.number,
                subjects: [newSubject],
              });
            }
          }
        }

        for (const oldSubject of oldLesson.subjects) {
          const newSubject = newLesson.subjects.find(
            (s) => s.name === oldSubject.name,
          );

          if (!newSubject) {
            updates.push({
              type: 'removedSubject',
              number: newLesson.number,
              subjects: [oldSubject],
            });
          }
        }
      }
    }

    for (const oldLesson of oldScheduleLessons) {
      const newLesson = newScheduleLessons.find(
        (l) => l.number === oldLesson.number,
      );

      if (!newLesson) {
        updates.push({
          type: 'removedLesson',
          number: oldLesson.number,
          subjects: oldLesson.subjects,
        });
      }
    }

    return updates;
  }
}
