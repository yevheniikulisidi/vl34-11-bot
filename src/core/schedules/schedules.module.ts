import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NzModule } from 'src/integrations/nz/nz.module';
import { SchedulesConsumer } from './consumers/schedules.consumer';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    BullModule.registerQueue({
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 3 },
        repeat: { cron: '*/5 * * * *' },
        stackTraceLimit: 10,
      },
      name: 'schedules',
    }),
    ConfigModule,
    NzModule,
  ],
  providers: [SchedulesService, SchedulesConsumer],
  exports: [SchedulesService],
})
export class SchedulesModule {}
