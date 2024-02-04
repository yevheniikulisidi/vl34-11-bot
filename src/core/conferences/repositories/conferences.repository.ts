import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import RandExp from 'randexp';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class ConferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findConferenceByUrlAndDateAndClass(
    originalConferenceUrl: string,
    scheduleClass: $Enums.Class,
    scheduleDate: string,
    select?: Prisma.ConferenceSelect,
  ) {
    return await this.prisma.conference.findUnique({
      where: {
        originalConferenceUrl_scheduleClass_scheduleDate: {
          originalConferenceUrl,
          scheduleClass,
          scheduleDate,
        },
      },
      select,
    });
  }

  async createConference(
    data: Pick<
      Prisma.ConferenceCreateInput,
      'originalConferenceUrl' | 'scheduleClass' | 'scheduleDate'
    >,
    select?: Prisma.ConferenceSelect,
  ) {
    const conferenceId = new RandExp(/[a-zA-Z0-9]{5}/).gen();

    return await this.prisma.conference.create({
      data: { id: conferenceId, ...data },
      select,
    });
  }

  async findConference(id: string, select?: Prisma.ConferenceSelect) {
    return await this.prisma.conference.findUnique({ where: { id }, select });
  }
}
