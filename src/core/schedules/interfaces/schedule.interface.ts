export interface ScheduleSubject {
  name: string;
  meetingUrl: string | null;
  teacherName: string;
}

export interface ScheduleLesson {
  number: number;
  startTime: string;
  endTime: string;
  subjects: ScheduleSubject[];
}

export interface ScheduleDate {
  date: string;
  lessons: ScheduleLesson[];
}

export interface Schedule {
  dates: ScheduleDate[];
}
