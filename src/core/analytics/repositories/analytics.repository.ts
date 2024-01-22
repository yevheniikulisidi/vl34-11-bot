import { Injectable } from '@nestjs/common';
import { Class } from '@prisma/client';
import dayjs from 'dayjs';
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
    const now = dayjs().tz('Europe/Kiev');
    const today = now.startOf('day');
    const thisWeekStart = now.startOf('week');
    const thisMonthStart = now.startOf('month');

    return await this.prisma.$transaction([
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11A',
          createdAt: { gte: today.toDate(), lte: today.endOf('day').toDate() },
        },
      }),
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11A',
          createdAt: {
            gte: thisWeekStart.toDate(),
            lte: thisWeekStart.endOf('week').toDate(),
          },
        },
      }),
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11A',
          createdAt: {
            gte: thisMonthStart.toDate(),
            lte: thisMonthStart.endOf('month').toDate(),
          },
        },
      }),
      this.prisma.analytics.count({ where: { scheduleClass: 'CLASS_11A' } }),
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11B',
          createdAt: { gte: today.toDate(), lte: today.endOf('day').toDate() },
        },
      }),
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11B',
          createdAt: {
            gte: thisWeekStart.toDate(),
            lte: thisWeekStart.endOf('week').toDate(),
          },
        },
      }),
      this.prisma.analytics.count({
        where: {
          scheduleClass: 'CLASS_11B',
          createdAt: {
            gte: thisMonthStart.toDate(),
            lte: thisMonthStart.endOf('month').toDate(),
          },
        },
      }),
      this.prisma.analytics.count({ where: { scheduleClass: 'CLASS_11B' } }),
      this.prisma.analytics.count({
        where: {
          createdAt: { gte: today.toDate(), lte: today.endOf('day').toDate() },
        },
      }),
      this.prisma.analytics.count({
        where: {
          createdAt: {
            gte: thisWeekStart.toDate(),
            lte: thisWeekStart.endOf('week').toDate(),
          },
        },
      }),
      this.prisma.analytics.count({
        where: {
          createdAt: {
            gte: thisMonthStart.toDate(),
            lte: thisMonthStart.endOf('month').toDate(),
          },
        },
      }),
      this.prisma.analytics.count(),
    ]);
  }
}
