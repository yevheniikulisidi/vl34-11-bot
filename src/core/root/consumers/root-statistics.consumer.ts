import { InjectRedis } from '@nestjs-modules/ioredis';
import { Processor, Process } from '@nestjs/bull';
import Redis from 'ioredis';
import { RootService } from '../root.service';

@Processor('root-statistics')
export class RootStatisticsConsumer {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly rootService: RootService,
  ) {}

  @Process()
  async handleJob() {
    const rootStatistics = await this.rootService.rootStatistics();
    await this.redis.set('root-statistics', JSON.stringify(rootStatistics));
  }
}
