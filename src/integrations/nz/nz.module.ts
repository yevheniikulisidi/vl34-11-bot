import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { NzService } from './nz.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api-mobile.nz.ua/v1',
      headers: { 'User-Agent': 'vl34-11-bot/2.6.1' },
    }),
  ],
  providers: [NzService],
  exports: [NzService],
})
export class NzModule {}
