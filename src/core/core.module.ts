import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { SchedulesModule } from './schedules/schedules.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AnalyticsModule, SchedulesModule, UsersModule],
})
export class CoreModule {}
