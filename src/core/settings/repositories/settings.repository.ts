import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSettings() {
    return await this.prisma.settings.findFirst();
  }

  async createSettings() {
    return await this.prisma.settings.create({ data: {} });
  }

  async updateSettings(
    id: string,
    data: Pick<Prisma.SettingsUpdateInput, 'isDistanceEducation'>,
  ) {
    return await this.prisma.settings.update({ data, where: { id } });
  }
}
