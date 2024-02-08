import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import 'dayjs/locale/uk';
import 'numeral/locales/uk-ua';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isToday from 'dayjs/plugin/isToday';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import numeral from 'numeral';
import { join } from 'path';
import { AppModule } from './app.module';

dayjs.extend(utc);
dayjs.extend(isToday);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);

numeral.locale('uk-ua');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  await app.listen(3000);
}
bootstrap();
