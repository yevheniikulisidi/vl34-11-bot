import { NestFactory } from '@nestjs/core';
import 'dayjs/locale/uk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isToday from 'dayjs/plugin/isToday';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { AppModule } from './app.module';

dayjs.extend(utc);
dayjs.extend(isToday);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
}
bootstrap();
