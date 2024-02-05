import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ConferencesModule } from '../conferences/conferences.module';
import { UsersModule } from '../users/users.module';
import { RootStatisticsConsumer } from './consumers/root-statistics.consumer';
import { RootController } from './root.controller';
import { RootService } from './root.service';

@Module({
  imports: [
    BullModule.registerQueue({
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 3 },
        repeat: { cron: '0 * * * *' },
        stackTraceLimit: 10,
      },
      name: 'root-statistics',
    }),
    AnalyticsModule,
    ConferencesModule,
    UsersModule,
  ],
  controllers: [RootController],
  providers: [RootService, RootStatisticsConsumer],
})
export class RootModule {}
