import { Controller, Get, Param, Res, Headers } from '@nestjs/common';
import { Response } from 'express';
import dayjs from 'dayjs';
import UAParser from 'ua-parser-js';
import { ConferencesAnalyticsRepository } from '../conferences/repositories/conferences-analytics.repository';
import { ConferencesRepository } from '../conferences/repositories/conferences.repository';

@Controller('meet')
export class MeetController {
  constructor(
    private readonly conferencesRepository: ConferencesRepository,
    private readonly conferencesAnalyticsRepository: ConferencesAnalyticsRepository,
  ) {}

  @Get(':conferenceId')
  async redirectToConference(
    @Param('conferenceId') conferenceId: string,
    @Headers('User-Agent') userAgent: string,
    @Res() res: Response,
  ) {
    const conference =
      await this.conferencesRepository.findConference(conferenceId);

    if (!conference) {
      res.render('not-found');
      return;
    }

    const scheduleDate = dayjs.utc(conference.scheduleDate).tz('Europe/Kyiv');
    const today = dayjs.utc().tz('Europe/Kyiv');

    if (!scheduleDate.isSame(today, 'date')) {
      res.render('past-conference');
      return;
    }

    const parsedUserAgent = new UAParser(userAgent);
    const device = parsedUserAgent.getDevice();
    const deviceType = device.type || 'desktop';

    await this.conferencesAnalyticsRepository.createConferenceAnalytics(
      {
        conference: { connect: { id: conferenceId } },
        deviceType,
      },
      { id: true },
    );

    res.redirect(conference.originalConferenceUrl);
  }
}
