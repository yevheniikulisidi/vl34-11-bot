import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { AnalyticsRepository } from '../analytics/repositories/analytics.repository';
import { ConferencesAnalyticsRepository } from '../conferences/repositories/conferences-analytics.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { RootStatistics } from './interfaces/root-statistics.interface';

@Injectable()
export class RootService implements OnModuleInit {
  constructor(
    @InjectQueue('root-statistics')
    private readonly rootStatisticsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly usersRepository: UsersRepository,
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly conferencesAnalyticsRepository: ConferencesAnalyticsRepository,
  ) {}

  async onModuleInit() {
    await this.rootStatisticsQueue.add({}, { jobId: 'main' });
  }

  async rootStatistics(): Promise<RootStatistics> {
    const userCount = await this.usersRepository.countUsers();
    const {
      _sum: { count: scheduleGettingCount },
    } = await this.analyticsRepository.countAnalytics();
    const connectedToLessonsCount =
      await this.conferencesAnalyticsRepository.countConferenceAnalytics();

    return {
      userCount,
      scheduleGettingCount: scheduleGettingCount
        ? +scheduleGettingCount.toString()
        : 0,
      connectedToLessonsCount,
    };
  }

  async getRootStatistics(): Promise<RootStatistics> {
    const cachedRootStatistics = await this.redis.get('root-statistics');

    if (!cachedRootStatistics) {
      const rootStatistics = await this.rootStatistics();
      await this.redis.set('root-statistics', JSON.stringify(rootStatistics));
      return rootStatistics;
    }

    return JSON.parse(cachedRootStatistics);
  }

  roundCount(count: number) {
    if (count < 100) {
      return count;
    } else if (count < 10000) {
      return Math.floor(count / 100) * 100 + '+';
    } else {
      return (Math.floor(count / 1000) * 1000).toLocaleString('uk') + '+';
    }
  }
}
