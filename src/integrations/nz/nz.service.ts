import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom, map } from 'rxjs';
import { Diary } from './interfaces/diary.interface';
import { Timetable } from './interfaces/timetable.interface';
import { User } from './interfaces/user.interface';

@Injectable()
export class NzService {
  constructor(private readonly httpService: HttpService) {}

  async login(username: string, password: string): Promise<User> {
    return await firstValueFrom(
      this.httpService
        .post('/user/login', { username, password })
        .pipe(map((response) => response.data)),
    );
  }

  async timetable(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<Timetable> {
    return await firstValueFrom(
      this.httpService
        .post(
          '/schedule/timetable',
          {
            start_date: startDate,
            end_date: endDate,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        .pipe(map((response) => response.data)),
    );
  }

  async diary(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<Diary> {
    return await firstValueFrom(
      this.httpService
        .post(
          '/schedule/diary',
          {
            start_date: startDate,
            end_date: endDate,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        .pipe(map((response) => response.data)),
    );
  }
}
