import { ScheduleSubject } from './schedule.interface';

export type LessonUpdateType =
  | 'addedLesson'
  | 'removedLesson'
  | 'addedSubject'
  | 'removedSubject'
  | 'addedMeetingUrl'
  | 'updatedMeetingUrl'
  | 'removedMeetingUrl';

export interface LessonUpdates {
  type: LessonUpdateType;
  number: number;
  subjects: ScheduleSubject[];
}
