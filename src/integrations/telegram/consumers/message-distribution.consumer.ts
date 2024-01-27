import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import {
  LessonUpdates,
  LessonUpdateType,
} from 'src/core/schedules/interfaces/lesson-updates.interface';
import { TelegramService } from '../telegram.service';

@Processor('message-distribution')
export class MessageDistributionConsumer {
  constructor(private readonly telegramService: TelegramService) {}

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
        '➕ Додано предмет ({{subjectsNames}}) {{lessonNumber}}-го уроку.',
      removedSubject:
        '➖ Видалено предмет ({{subjectsNames}}) {{lessonNumber}}-го уроку.',
      addedMeetingUrl:
        '🔗 Додано посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку.',
      updatedMeetingUrl:
        '🔄 Оновлено посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку.',
      removedMeetingUrl:
        '❌ Видалено посилання на конференцію предмета ({{subjectsNames}}) {{lessonNumber}}-го уроку.',
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
          );

        return lessonUpdateText;
      })
      .join('\n\n');

    await this.telegramService.sendMessage(job.data.userId, lessonUpdatesText);
  }
}
