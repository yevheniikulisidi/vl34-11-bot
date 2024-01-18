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
}