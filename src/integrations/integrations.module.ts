import { Module } from '@nestjs/common';
import { NzModule } from './nz/nz.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [NzModule, TelegramModule],
})
export class IntegrationsModule {}
