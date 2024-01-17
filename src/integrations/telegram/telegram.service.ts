import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Class } from '@prisma/client';
import { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard } from 'grammy';
import { SchedulesService } from 'src/core/schedules/schedules.service';
import { UsersRepository } from 'src/core/users/repositories/users.repository';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly schedulesService: SchedulesService,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const clientEnvironment = this.configService.getOrThrow<string>('NODE_ENV');

    this.bot = new Bot(token, {
      client: {
        environment: clientEnvironment === 'production' ? 'prod' : 'test',
      },
    });
  }

  onModuleInit() {
    // Commands
    this.onStartCommand();

    // Texts
    this.onProfileText();

    // Callback queries
    this.onModifyUserClassCallbackQuery();
    this.onSetOrChangeUserClassCallbackQuery();

    this.bot.start({
      allowed_updates: ['callback_query', 'message'],
      drop_pending_updates: true,
    });

    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}:`);

      const e = err.error;
      if (e instanceof GrammyError) {
        this.logger.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        this.logger.error('Could not contact Telegram:', e);
      } else {
        this.logger.error('Unknown error:', e);
      }
    });
  }

  onStartCommand() {
    this.bot.command('start', async (ctx) => {
      const welcomeText =
        'Привіт! Тут для тебе: розклад, конференції — все швидко та легко! 🚀';
      const mainKeyboard = this.getMainKeyboard();

      await ctx.reply(welcomeText, { reply_markup: mainKeyboard });

      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        await this.usersRepository.createUser({ id: userId });
      }
    });
  }

  getMainKeyboard() {
    return new Keyboard().text('📅 Розклад').text('👤 Профіль').resized();
  }

  onProfileText() {
    this.bot.hears('👤 Профіль', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        await ctx.reply('Створи профіль за допомогою команди /start');
        return;
      }

      const userClassText =
        user.class === 'CLASS_11A'
          ? '11-А'
          : user.class === 'CLASS_11B'
            ? '11-Б'
            : 'не встановлено';
      const profileText =
        '<b>Профіль</b>' +
        `\nID: <code>${userId}</code>` +
        `\nКлас: <code>${userClassText}</code>`;
      const modifyUserClassText = user.class
        ? 'Змінити клас'
        : 'Встановити клас';
      const modifyUserClassData = user.class
        ? 'change-user-class'
        : 'set-user-class';
      const profileKeyboard = new InlineKeyboard().text(
        modifyUserClassText,
        modifyUserClassData,
      );

      await ctx.reply(profileText, {
        parse_mode: 'HTML',
        reply_markup: profileKeyboard,
      });
    });
  }

  onModifyUserClassCallbackQuery() {
    this.bot.callbackQuery(/^(set|change)-user-class$/, async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        await ctx.reply('Створи профіль за допомогою команди /start');
        return;
      }

      const modifyUserClassText = 'Обери клас:';
      const operation = ctx.match[1];
      const modifyUserClassKeyboard = new InlineKeyboard()
        .text('11-А', `${operation}-user-class:11a`)
        .row()
        .text('11-Б', `${operation}-user-class:11b`);

      await ctx.editMessageText(modifyUserClassText, {
        reply_markup: modifyUserClassKeyboard,
      });
      await ctx.answerCallbackQuery();
    });
  }

  onSetOrChangeUserClassCallbackQuery() {
    this.bot.callbackQuery(
      /^(set|change)-user-class:(11a|11b)$/,
      async (ctx) => {
        if (!ctx.from) return;

        const userId = ctx.from.id;
        const user = await this.usersRepository.findUser(userId);

        if (!user) {
          await ctx.reply('Створи профіль за допомогою команди /start');
          return;
        }

        const match = ctx.match;
        const _class = `CLASS_${match[2].toLocaleUpperCase()}` as Class;

        await this.usersRepository.updateUser(userId, {
          class: { set: _class },
        });

        const setOrChangeUserClassText =
          match[1] === 'set'
            ? 'Клас успішно встановлено ✅'
            : 'Клас успішно змінено ✅';

        await ctx.editMessageText(setOrChangeUserClassText);
        await ctx.answerCallbackQuery();
      },
    );
  }
}
