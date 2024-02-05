import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { ConferencesModule } from './conferences/conferences.module';
import { MeetModule } from './meet/meet.module';
import { RootModule } from './root/root.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AnalyticsModule,
    ConferencesModule,
    MeetModule,
    RootModule,
    SchedulesModule,
    SettingsModule,
    UsersModule,
  ],
})
export class CoreModule {}
