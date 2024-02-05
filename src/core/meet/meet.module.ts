import { Module } from '@nestjs/common';
import { ConferencesModule } from '../conferences/conferences.module';
import { MeetController } from './meet.controller';

@Module({
  imports: [ConferencesModule],
  controllers: [MeetController],
})
export class MeetModule {}
