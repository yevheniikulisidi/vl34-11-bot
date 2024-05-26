import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import dayjs from 'dayjs';
import { AnalyticsRepository } from 'src/core/analytics/repositories/analytics.repository';
import {
  LessonUpdates,
  LessonUpdateType,
} from 'src/core/schedules/interfaces/lesson-updates.interface';
import { SchedulesService } from 'src/core/schedules/schedules.service';
import { UsersRepository } from 'src/core/users/repositories/users.repository';
import { Season } from '../enums/season.enum';
import { TelegramService } from '../telegram.service';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { InputFile, InputMediaBuilder } from 'grammy';

@Processor('message-distribution')
export class MessageDistributionConsumer {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly usersRepository: UsersRepository,
    private readonly schedulesService: SchedulesService,
    private readonly analyticsRepository: AnalyticsRepository,
  ) {}

  @Process('update')
  async onUpdate(job: Job<{ userId: string }>) {
    const updateTitleText = 'Нова функція бота ✨';
    const updateContentText =
      'Тепер бот висилає щоденний розклад уроків на наступний день вранці о 7:30.' +
      '\n\n' +
      '🔄 Якщо буде зміна в розкладі і ти підписаний на "Оновлення уроків", бот тебе про неї сповістить.' +
      '\n\n' +
      '<i>Підписатися або відписатися від отримання щоденного розкладу можна в профілі.</i>';
    const updateText = `<b>${updateTitleText}</b>` + '\n\n' + updateContentText;

    await this.telegramService.sendMessage(job.data.userId, updateText);
  }

  @Process('theend')
  async onTheEnd(job: Job<{ userId: string }>) {
    const theEndText =
      'Ну що ж, настав цей день. Останній дзвінок і прощання з нашим рідним ліцеєм. Здається, лише недавно, 11 років тому, ми вперше переступили поріг першого класу. Тоді нам здавалося, що попереду ціла вічність, але ось і все – 11 років промайнули, як одна мить. Це були незабутні часи, наповнені радощами, труднощами, новими знаннями та справжніми друзями. Тепер перед нами відкривається новий етап життя, повний мрій і можливостей.' +
      '\n\nДякую Вам за те, що користувалися цим ботом. Я постійно вдосконалював його, прислухаючись до Ваших ідей та побажань. Бот працював 8 місяців для наших класів 11-А та 11-Б. Було вкладено багато сил і подолано чимало проблем. Я вдячний Вам за підтримку та активність, які допомогли зробити цей проєкт кращим.' +
      "\n\nПеред нами стоять нові виклики та можливості. Ми всі різні, але кожен має потенціал досягти великих висот у житті. Пам'ятайте про підтримку одне одного та про уроки, які ми отримали в ліцеї. Вірю, що наше майбутнє буде яскравим і наповненим досягненнями, а дружба та знання, здобуті тут, супроводжуватимуть нас у всіх нових починаннях.";

    const assests = await readdir(
      join(__dirname, '..', '..', '..', '..', 'assets'),
    );

    await this.telegramService.sendTheEndMessage(
      job.data.userId,
      assests.map((assetFile) =>
        InputMediaBuilder.photo(
          new InputFile(
            join(__dirname, '..', '..', '..', '..', 'assets', assetFile),
          ),
        ),
      ),
      theEndText,
    );
  }

  @Process('lesson-updates')
  async onLessonUpdates(
    job: Job<{ userId: string; lessonUpdates: LessonUpdates[] }>,
  ) {
    const lessonUpdateTexts: Record<LessonUpdateType, string> = {
      addedLesson: '📚 Додано {{lessonNumber}}-й урок ({{subjectsNames}}).',
      removedLesson: '🗑️ Видалено {{lessonNumber}}-й урок ({{subjectsNames}}).',
      addedSubject:
        '➕ Додано предмет ({{subjectsNames}}) {{lessonNumber}}-го уроку викладачем {{teacherName}}',
      removedSubject:
        '➖ Видалено предмет ({{subjectsNames}}) {{lessonNumber}}-го уроку викладачем {{teacherName}}',
      addedMeetingUrl:
        '🔗 Додано посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку викладачем {{teacherName}}',
      updatedMeetingUrl:
        '🔄 Оновлено посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку викладачем {{teacherName}}',
      removedMeetingUrl:
        '❌ Видалено посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку викладачем {{teacherName}}',
    };

    const lessonUpdatesText = job.data.lessonUpdates
      .map((lessonUpdate) => {
        const lessonUpdateType = lessonUpdate.type;
        const lessonUpdateTextTemplate = lessonUpdateTexts[lessonUpdateType];

        const lessonUpdateText = lessonUpdateTextTemplate
          .replace('{{lessonNumber}}', lessonUpdate.number.toString())
          .replace(
            '{{subjectsNames}}',
            lessonUpdate.subjects
              .map((subject) => subject.name.toLowerCase())
              .join('/'),
          )
          .replace(
            '{{teacherName}}',
            lessonUpdate.subjects
              .map((subject) => subject.teacherName)
              .join('/'),
          );

        return lessonUpdateText;
      })
      .join('\n\n');

    await this.telegramService.sendMessage(job.data.userId, lessonUpdatesText);
  }

  @Process('announcement')
  async onAnnouncement(job: Job<{ userId: string; _class: '11a' | '11b' }>) {
    const schedule = {
      class11a:
        'https://docs.google.com/spreadsheets/d/10rRr75cCJqXwacZQIMvBSTOgz3g3YU9y3V2335BhybA/edit?usp=sharing',
      class11b:
        'https://docs.google.com/spreadsheets/d/1vNGEBvlPthMrKYjusA5w4Tx2MV6W3gA2WhSVMHSWWpw/edit?usp=sharing',
    };

    const announcementTitleText = 'Важливе оголошення ⚠️';
    const scheduleUrl =
      job.data._class === '11a' ? schedule.class11a : schedule.class11b;
    const announcementContentText =
      'Через часті збої доступу до веб-сайту (Нові Знання) викладачі та інші користувачі стикаються з проблемами у доступі. ' +
      `Будь ласка, скористайся тимчасовим розкладом у Google-таблиці: ${scheduleUrl}`;
    const announcementText =
      `<b>${announcementTitleText}</b>` + '\n\n' + announcementContentText;

    await this.telegramService.sendMessage(job.data.userId, announcementText);
  }

  @Process('daily-schedule')
  async onDailySchedule(job: Job<{ userId: string }>) {
    const vacations: { season: Season; startDate: string; endDate: string }[] =
      [
        {
          season: Season.AUTUMN,
          startDate: '2023-10-23',
          endDate: '2023-10-29',
        },
        {
          season: Season.WINTER,
          startDate: '2023-12-23',
          endDate: '2024-01-07',
        },
        {
          season: Season.SPRING,
          startDate: '2024-03-25',
          endDate: '2024-03-31',
        },
        {
          season: Season.SUMMER,
          startDate: '2024-06-29',
          endDate: '2024-08-31',
        },
      ];

    const currentDate = dayjs.utc().tz('Europe/Kyiv');

    const currentVacation = vacations.find((vacation) => {
      const startDate = dayjs(vacation.startDate);
      const endDate = dayjs(vacation.endDate);

      return currentDate.isBetween(startDate, endDate, null, '[]');
    });

    if (currentVacation) {
      return;
    }

    const user = await this.usersRepository.findUser(+job.data.userId);

    if (!user) {
      return;
    }

    const today = dayjs().tz('Europe/Kyiv');
    const userClass = user.class === 'CLASS_11A' ? '11a' : '11b';
    const schedule = await this.schedulesService.getSchedule(
      userClass,
      today.format('YYYY-MM-DD'),
    );

    if (schedule.length === 0) {
      const noScheduleText = `📆 Щоденний розклад (${today.format(
        'DD.MM.YYYY',
      )})\n\nУроків немає.`;

      await this.telegramService.sendMessage(job.data.userId, noScheduleText);

      return;
    }

    const dayText = `📆 Щоденний розклад (${today.format('DD.MM.YYYY')})`;
    const lessonsText = schedule
      .map((lesson) => {
        const formattedStartTime = dayjs
          .utc(lesson.startTime, 'HH:mm')
          .tz('Europe/Kyiv')
          .format('H:mm');
        const formattedEndTime = dayjs
          .utc(lesson.endTime, 'HH:mm')
          .tz('Europe/Kyiv')
          .format('H:mm');

        const formattedLesson =
          `${lesson.number}-й урок (${formattedStartTime} - ${formattedEndTime})\n` +
          `${lesson.subjects
            .map(
              (subject) =>
                `${
                  subject.meetingUrl
                    ? `<a href="${subject.meetingUrl}">- ${subject.name} (${subject.teacherName})</a>`
                    : `- ${subject.name} (${subject.teacherName})`
                }`,
            )
            .join('\n')}`;

        return formattedLesson;
      })
      .join('\n\n');

    const updatedAt = await this.schedulesService.updatedAt(userClass);

    const now = dayjs().utc();
    const nzProblemsText =
      updatedAt && now.diff(dayjs(updatedAt), 'minute') >= 10
        ? `<b>⚠️ Увага! Останнє оновлення розкладу: ${dayjs(updatedAt)
            .tz('Europe/Kyiv')
            .format('DD.MM.YYYY о HH:mm')}.</b>`
        : '';

    const scheduleText = `<b>${dayText}</b>\n\n${lessonsText}\n\n${nzProblemsText}`;

    await this.telegramService.sendMessage(job.data.userId, scheduleText);

    const analytics = await this.analyticsRepository.findAnalytics(
      user.class,
      today.toISOString(),
    );

    if (!analytics) {
      await this.analyticsRepository.createAnalytics(
        user.class,
        today.toISOString(),
      );
    } else {
      await this.analyticsRepository.updateAnalytics(
        user.class,
        today.toISOString(),
      );
    }
  }
}
