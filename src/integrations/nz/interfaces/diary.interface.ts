export interface DiaryLesson {
  type: string;
  mark: string;
  comment: string | null;
}

export interface DiarySubject {
  lesson: DiaryLesson[];
  hometask: string[];
  distance_hometask_id: number | null;
  distance_hometask_is_closed: boolean | null;
  subject_name: string;
  room: string;
}

export interface DiaryCall {
  call_id: number | null;
  call_number: number | null;
  subjects: DiarySubject[];
}

export interface DiaryDate {
  date: string;
  calls: DiaryCall[];
}

export interface Diary {
  dates: DiaryDate[];
  error_message: string;
}
