import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class ConferencesAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConferenceAnalytics(
    data: Pick<
      Prisma.ConferenceAnalyticsCreateInput,
      'conference' | 'deviceType'
    >,
    select?: Prisma.ConferenceAnalyticsSelect,
  ) {
    return await this.prisma.conferenceAnalytics.create({ data, select });
  }
}
