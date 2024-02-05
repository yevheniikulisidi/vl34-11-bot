import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSettings(select?: Prisma.SettingsSelect) {
    return await this.prisma.settings.findFirst({ select });
  }

  async createSettings(select?: Prisma.SettingsSelect) {
    return await this.prisma.settings.create({ data: {}, select });
  }

  async updateSettings(
    id: string,
    data: Pick<
      Prisma.SettingsUpdateInput,
      'isDistanceEducation' | 'isTechnicalWorks'
    >,
  ) {
    return await this.prisma.settings.update({ data, where: { id } });
  }
}
