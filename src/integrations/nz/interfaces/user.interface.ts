export interface User {
  access_token: string;
  refresh_token: string;
  expires_token: number;
  email_hash: string;
  student_id: number;
  FIO: string;
  avatar: {
    image_url: string | null;
    datetime: number | null;
  };
  permissions: {
    isuo_nzportal_children: string[];
  };
  error_message: string;
}
