import { Module } from '@nestjs/common';
import { SchedulesModule } from './schedules/schedules.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [SchedulesModule, UsersModule],
})
export class CoreModule {}
