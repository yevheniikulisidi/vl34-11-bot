import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ConferencesAnalyticsRepository } from './repositories/conferences-analytics.repository';
import { ConferencesRepository } from './repositories/conferences.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ConferencesAnalyticsRepository, ConferencesRepository],
  exports: [ConferencesAnalyticsRepository, ConferencesRepository],
})
export class ConferencesModule {}
