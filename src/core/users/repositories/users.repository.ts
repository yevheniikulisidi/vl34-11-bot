import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: number | bigint) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: Pick<Prisma.UserCreateInput, 'id'>) {
    return await this.prisma.user.create({ data });
  }

  async updateUser(
    id: number | bigint,
    data: Pick<Prisma.UserUpdateInput, 'class'>,
  ) {
    return await this.prisma.user.update({ data, where: { id } });
  }

  async countClassesUsers() {
    return this.prisma.$transaction([
      this.prisma.user.count({ where: { class: 'CLASS_11A' } }),
      this.prisma.user.count({ where: { class: 'CLASS_11B' } }),
      this.prisma.user.count({ where: { class: null } }),
      this.prisma.user.count(),
    ]);
  }
}
