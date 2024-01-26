import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from 'src/core/analytics/analytics.module';
import { SchedulesModule } from 'src/core/schedules/schedules.module';
import { SettingsModule } from 'src/core/settings/settings.module';
import { UsersModule } from 'src/core/users/users.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    ConfigModule,
    AnalyticsModule,
    SchedulesModule,
    SettingsModule,
    UsersModule,
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
