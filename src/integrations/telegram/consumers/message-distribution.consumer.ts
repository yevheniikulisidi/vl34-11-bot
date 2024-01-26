import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
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
}
