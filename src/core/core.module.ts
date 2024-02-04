import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { ConferencesModule } from './conferences/conferences.module';
import { MeetModule } from './meet/meet.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AnalyticsModule,
    ConferencesModule,
    MeetModule,
    SchedulesModule,
    SettingsModule,
    UsersModule,
  ],
})
export class CoreModule {}
