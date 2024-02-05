import { Processor, Process } from '@nestjs/bull';
import { RootService } from '../root.service';

@Processor('root-statistics')
export class RootStatisticsConsumer {
  constructor(private readonly rootService: RootService) {}

  @Process()
  async handleJob() {
    await this.rootService.getRootStatistics();
  }
}
