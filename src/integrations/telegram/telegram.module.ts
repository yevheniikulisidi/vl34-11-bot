import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchedulesModule } from 'src/core/schedules/schedules.module';
import { UsersModule } from 'src/core/users/users.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule, SchedulesModule, UsersModule],
  providers: [TelegramService],
})
export class TelegramModule {}
