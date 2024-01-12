import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [CoreModule, IntegrationsModule],
})
export class AppModule {}
