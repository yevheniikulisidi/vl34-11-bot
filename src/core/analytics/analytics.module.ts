import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AnalyticsRepository } from './repositories/analytics.repository';

@Module({
  imports: [DatabaseModule],
  providers: [AnalyticsRepository],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}
