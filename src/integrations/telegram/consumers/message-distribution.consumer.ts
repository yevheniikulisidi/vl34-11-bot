import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import dayjs from 'dayjs';
import {
  LessonUpdates,
  LessonUpdateType,
} from 'src/core/schedules/interfaces/lesson-updates.interface';
import { SchedulesService } from 'src/core/schedules/schedules.service';
import { UsersRepository } from 'src/core/users/repositories/users.repository';
import { TelegramService } from '../telegram.service';

@Processor('message-distribution')
export class MessageDistributionConsumer {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly usersRepository: UsersRepository,
    private readonly schedulesService: SchedulesService,
  ) {}

  @Process('update')
  async onUpdate(job: Job<{ userId: string }>) {
    const updateTitleText = 'Нова функція бота ✨';
    const updateContentText =
      'Тепер бот моментально сповіщає, якщо викладач вніс зміни в посилання на конференції або уроки.' +
      '\n\n' +
      '<i>Підписатися або відписатися від отримання сповіщень можна в профілі.</i>';
    const updateText = `<b>${updateTitleText}</b>` + '\n\n' + updateContentText;

    await this.telegramService.sendMessage(job.data.userId, updateText);
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
    const user = await this.usersRepository.findUser(+job.data.userId);

    if (!user) {
      return;
    }

    const today = dayjs().tz('Europe/Kyiv');
    const scheduleDate = today.format('YYYY-MM-DD');
    const userClass = user.class === 'CLASS_11A' ? '11a' : '11b';
    const schedule = await this.schedulesService.getSchedule(
      userClass,
      scheduleDate,
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
  }
}
