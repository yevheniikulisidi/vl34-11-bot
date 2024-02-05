import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import {
  Diary,
  DiaryCall,
  DiarySubject,
} from 'src/integrations/nz/interfaces/diary.interface';
import { NzService } from 'src/integrations/nz/nz.service';
import { ConferencesRepository } from '../conferences/repositories/conferences.repository';
import {
  Schedule,
  ScheduleDate,
  ScheduleLesson,
  ScheduleSubject,
} from './interfaces/schedule.interface';

@Injectable()
export class SchedulesService implements OnModuleInit {
  constructor(
    @InjectQueue('schedules') private readonly schedulesQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly nzService: NzService,
    private readonly configService: ConfigService,
    private readonly conferencesRepository: ConferencesRepository,
  ) {}

  async onModuleInit() {
    await this.schedulesQueue.add({ class: '11a' }, { jobId: '11a' });
    await this.schedulesQueue.add({ class: '11b' }, { jobId: '11b' });
  }

  async schedule(
    scheduleClass: '11a' | '11b',
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<Schedule> {
    const [timetable, diary] = await Promise.all([
      this.nzService.timetable(accessToken, startDate, endDate),
      this.nzService.diary(accessToken, startDate, endDate),
    ]);

    const customMeetingDomain = this.configService.getOrThrow<string>(
      'CUSTOM_MEETING_DOMAIN',
    );

    const dates: ScheduleDate[] = [];

    for (const date of timetable.dates) {
      const lessons: ScheduleLesson[] = [];

      for (const lesson of date.calls) {
        const subjects: ScheduleSubject[] = [];

        for (const subject of lesson.subjects) {
          const diaryLesson = this.findDiaryCall(
            date.date,
            lesson.call_number,
            diary,
          );

          const meetingUrl = diaryLesson
            ? this.findMeetingUrl(diaryLesson.subjects)
            : null;

          if (!meetingUrl) {
            subjects.push({
              name: this.cleanSubjectName(subject.subject_name),
              meetingUrl,
              teacherName: subject.teacher.name,
            });
            continue;
          }

          const scheduleDate = dayjs.utc(date.date).toISOString();

          const conference =
            await this.conferencesRepository.findConferenceByUrlAndDateAndClass(
              meetingUrl,
              scheduleClass === '11a' ? 'CLASS_11A' : 'CLASS_11B',
              scheduleDate,
              { id: true },
            );

          if (!conference) {
            const createdConference =
              await this.conferencesRepository.createConference(
                {
                  originalConferenceUrl: meetingUrl,
                  scheduleClass:
                    scheduleClass === '11a' ? 'CLASS_11A' : 'CLASS_11B',
                  scheduleDate,
                },
                { id: true },
              );
            subjects.push({
              name: this.cleanSubjectName(subject.subject_name),
              meetingUrl: `${customMeetingDomain}/meet/${createdConference.id}`,
              teacherName: subject.teacher.name,
            });
          } else {
            subjects.push({
              name: this.cleanSubjectName(subject.subject_name),
              meetingUrl: `${customMeetingDomain}/meet/${conference.id}`,
              teacherName: subject.teacher.name,
            });
          }
        }

        lessons.push({
          number: lesson.call_number,
          startTime: this.formatTime(lesson.time_start),
          endTime: this.formatTime(lesson.time_end),
          subjects,
        });
      }

      dates.push({ date: date.date, lessons });
    }

    return { dates };
  }

  private cleanSubjectName(subjectName: string) {
    return subjectName.replace(/\s{2}/g, ' ').trim();
  }

  private formatTime(time: string): string {
    return dayjs.tz(time, 'HH:mm', 'Europe/Kyiv').utc().format('HH:mm');
  }

  private findDiaryCall(
    scheduleDate: string,
    callNumber: number,
    diary: Diary,
  ): DiaryCall | undefined {
    return diary.dates
      .filter((diaryDate) => diaryDate.date === scheduleDate)
      .flatMap((diaryDate) => diaryDate.calls)
      .find((diaryCall) => diaryCall.call_number === callNumber);
  }

  private findMeetingUrl(subjects: DiarySubject[]): string | null {
    for (const diarySubject of subjects) {
      const hometasks = diarySubject.hometask;

      if (hometasks && Array.isArray(hometasks)) {
        const meetingUrl = hometasks
          .map((task) => task.match(/meet\.google\.com\/([a-z-]+)/))
          .find((match) => match !== null);

        if (meetingUrl) {
          return `https://meet.google.com/${meetingUrl[1]}`;
        }
      }
    }

    return null;
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

  async findScheduleLessons(
    scheduleClass: '11a' | '11b',
    scheduleDate: string,
  ): Promise<ScheduleLesson[]> {
    const schedule = await this.redis.get(
      `${scheduleClass}:schedule:${scheduleDate}`,
    );

    return schedule ? JSON.parse(schedule) : [];
  }

  async getUpdatedAtSchedule(scheduleClass: '11a' | '11b') {
    const data = await this.redis.get(`${scheduleClass}:updated-at`);
    return data ? data : null;
  }
}
