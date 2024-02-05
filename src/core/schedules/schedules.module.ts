import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NzModule } from 'src/integrations/nz/nz.module';
import { ConferencesModule } from '../conferences/conferences.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
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
    BullModule.registerQueue({
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 3 },
        stackTraceLimit: 10,
      },
      limiter: { duration: 1000, max: 15 },
      name: 'message-distribution',
    }),
    ConfigModule,
    NzModule,
    ConferencesModule,
    SettingsModule,
    UsersModule,
  ],
  providers: [SchedulesService, SchedulesConsumer],
  exports: [SchedulesService],
})
export class SchedulesModule {}
