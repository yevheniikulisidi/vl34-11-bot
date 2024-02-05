import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: number, select?: Prisma.UserSelect) {
    return await this.prisma.user.findUnique({ where: { id }, select });
  }

  async createUser(
    data: Pick<Prisma.UserCreateInput, 'id' | 'class'>,
    select?: Prisma.UserSelect,
  ) {
    return await this.prisma.user.create({ data, select });
  }

  async updateUser(
    id: number | bigint,
    data: Pick<
      Prisma.UserUpdateInput,
      'class' | 'isNotifyingLessonUpdates' | 'isGettingDailySchedule'
    >,
    select?: Prisma.UserSelect,
  ) {
    return await this.prisma.user.update({ data, where: { id }, select });
  }

  async findUsersWithId() {
    return await this.prisma.user.findMany({ select: { id: true } });
  }

  async findUsersNotifyingLessonUpdates(_class: $Enums.Class) {
    return await this.prisma.user.findMany({
      select: { id: true },
      where: { class: _class, isNotifyingLessonUpdates: true },
    });
  }

  async findUsersWithIdAndClass() {
    return await this.prisma.user.findMany({
      select: { id: true, class: true },
    });
  }

  async countUsers() {
    return await this.prisma.user.count();
  }
}
