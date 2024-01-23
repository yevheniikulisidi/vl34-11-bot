import { Injectable } from '@nestjs/common';
import { Class } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAnalytics(scheduleClass: Class, scheduleDate: string) {
    return await this.prisma.analytics.findUnique({
      where: { scheduleClass_scheduleDate: { scheduleClass, scheduleDate } },
    });
  }

  async createAnalytics(scheduleClass: Class, scheduleDate: string) {
    return await this.prisma.analytics.create({
      data: { scheduleClass, scheduleDate },
    });
  }

  async updateAnalytics(scheduleClass: Class, scheduleDate: string) {
    return await this.prisma.analytics.update({
      data: { count: { increment: 1 } },
      where: { scheduleClass_scheduleDate: { scheduleClass, scheduleDate } },
    });
  }

  async countAnalytics() {
    return await this.prisma.$transaction([
      this.prisma.analytics.aggregate({
        _sum: { count: true },
        where: { scheduleClass: 'CLASS_11A' },
      }),
      this.prisma.analytics.aggregate({
        _sum: { count: true },
        where: { scheduleClass: 'CLASS_11B' },
      }),
      this.prisma.analytics.aggregate({ _sum: { count: true } }),
    ]);
  }
}
