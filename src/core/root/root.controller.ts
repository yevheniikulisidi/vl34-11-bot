import { Controller, Get, Render } from '@nestjs/common';
import { RootService } from './root.service';

@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @Get()
  @Render('root')
  async root() {
    const rootStatistics = await this.rootService.getRootStatistics();

    return {
      userCount: rootStatistics.userCount,
      scheduleGettingCount: this.rootService.formatCount(
        +rootStatistics.scheduleGettingCount,
      ),
      connectedToLessonsCount: this.rootService.formatCount(
        rootStatistics.connectedToLessonsCount,
      ),
    };
  }
}
