import { Module } from '@nestjs/common';
import { NzModule } from './nz/nz.module';

@Module({
  imports: [NzModule],
})
export class IntegrationsModule {}
