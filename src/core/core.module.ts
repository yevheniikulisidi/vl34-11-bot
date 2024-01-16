import { Module } from '@nestjs/common';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [SchedulesModule],
})
export class CoreModule {}
