export interface TimetableSubject {
  subject_name: string;
  room: string;
  teacher: {
    id: number;
    name: string;
  };
}

export interface TimetableCall {
  call_id: number;
  call_number: number;
  time_start: string;
  time_end: string;
  subjects: TimetableSubject[];
}

export interface TimetableDate {
  date: string;
  calls: TimetableCall[];
}

export interface Timetable {
  dates: TimetableDate[];
  error_message: string;
}
