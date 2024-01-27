import { Module } from '@nestjs/common';
import { SettingsRepository } from './repositories/settings.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SettingsRepository],
  exports: [SettingsRepository],
})
export class SettingsModule {}
