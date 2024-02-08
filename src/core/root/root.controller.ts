import { Controller, Get, Render } from '@nestjs/common';
import numeral from 'numeral';
import { RootService } from './root.service';

@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @Get()
  @Render('root')
  async root() {
    const rootStatistics = await this.rootService.getRootStatistics();

    return {
      userCount: numeral(rootStatistics.userCount).format('0 a'),
      scheduleGettingCount: numeral(rootStatistics.scheduleGettingCount).format(
        '0 a',
      ),
      connectedToLessonsCount: numeral(
        rootStatistics.connectedToLessonsCount,
      ).format('0 a'),
    };
  }
}
