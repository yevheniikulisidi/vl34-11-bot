import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from 'src/core/analytics/analytics.module';
import { SchedulesModule } from 'src/core/schedules/schedules.module';
import { SettingsModule } from 'src/core/settings/settings.module';
import { UsersModule } from 'src/core/users/users.module';
import { MessageDistributionConsumer } from './consumers/message-distribution.consumer';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
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
    AnalyticsModule,
    SchedulesModule,
    SettingsModule,
    UsersModule,
  ],
  providers: [TelegramService, MessageDistributionConsumer],
})
export class TelegramModule {}
