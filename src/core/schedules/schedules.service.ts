import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import {
  Diary,
  DiaryCall,
  DiarySubject,
} from 'src/integrations/nz/interfaces/diary.interface';
import { NzService } from 'src/integrations/nz/nz.service';
import { Schedule, ScheduleLesson } from './interfaces/schedule.interface';

@Injectable()
export class SchedulesService implements OnModuleInit {
  constructor(
    @InjectQueue('schedules') private readonly schedulesQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly nzService: NzService,
  ) {}

  async onModuleInit() {
    await this.schedulesQueue.add({ class: '11a' }, { jobId: '11a' });
    await this.schedulesQueue.add({ class: '11b' }, { jobId: '11b' });
  }

  async schedule(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<Schedule> {
    const [timetable, diary] = await Promise.all([
      this.nzService.timetable(accessToken, startDate, endDate),
      this.nzService.diary(accessToken, startDate, endDate),
    ]);

    return {
      dates: timetable.dates.map((timetableDate) => ({
        date: timetableDate.date,
        lessons: timetableDate.calls.map((timetableCall) => {
          const diaryCall = this.findDiaryCall(
            timetableCall.call_number,
            diary,
          );

          return {
            number: timetableCall.call_number,
            startTime: this.formatTime(timetableCall.time_start),
            endTime: this.formatTime(timetableCall.time_end),
            subjects: timetableCall.subjects.map((timetableSubject) => ({
              name: timetableSubject.subject_name.replace(/\s{2}/g, ' ').trim(),
              meetingUrl: diaryCall
                ? this.findMeetingUrl(diaryCall.subjects)
                : null,
            })),
          };
        }),
      })),
    };
  }

  private formatTime(time: string): string {
    return dayjs.tz(time, 'HH:mm', 'Europe/Kyiv').utc().format('HH:mm');
  }

  private findDiaryCall(
    callNumber: number,
    diary: Diary,
  ): DiaryCall | undefined {
    return diary.dates
      .flatMap((diaryDate) => diaryDate.calls)
      .find((diaryCall) => diaryCall.call_number === callNumber);
  }

  private findMeetingUrl(subjects: DiarySubject[]): string | null {
    return (
      subjects
        .flatMap((diarySubject) => diarySubject.hometask)
        .find((diaryHometask) => {
          const match = diaryHometask.match(/meet\.google\.com\/([a-z-]+)/);
          return match ? `https://meet.google.com/${match[1]}` : null;
        }) || null
    );
  }

  async getSchedule(
    _class: '11a' | '11b',
    date: string,
  ): Promise<ScheduleLesson[]> {
    const data = await this.redis.get(`${_class}:schedule:${date}`);

    if (!data) {
      return [];
    }

    return JSON.parse(data);
  }

  async updatedAt(_class: '11a' | '11b') {
    const data = await this.redis.get(`${_class}:updated-at`);

    if (!data) {
      return null;
    }

    return data;
  }
}
