import { Module } from '@nestjs/common';
import { NzModule } from 'src/integrations/nz/nz.module';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [NzModule],
  providers: [SchedulesService],
})
export class SchedulesModule {}
