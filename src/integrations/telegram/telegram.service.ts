import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Class } from '@prisma/client';
import dayjs from 'dayjs';
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
    this.onScheduleText();

    // Callback queries
    this.onModifyUserClassCallbackQuery();
    this.onSetOrChangeUserClassCallbackQuery();
    this.onScheduleCallbackQuery();

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

  onScheduleText() {
    this.bot.hears('📅 Розклад', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        const mainKeyboard = this.getMainKeyboard();

        await ctx.reply('Створи профіль за допомогою команди /start', {
          reply_markup: mainKeyboard,
        });

        return;
      }

      if (!user.class) {
        const classesText = 'Спочатку обери свій клас:';
        const classesKeyboard = new InlineKeyboard()
          .text('11-А', 'set-user-class:11a')
          .row()
          .text('11-Б', 'set-user-class:11b');

        await ctx.reply(classesText, { reply_markup: classesKeyboard });

        return;
      }

      const scheduleText = 'Вибери день тижня:';
      const now = dayjs().tz('Europe/Kyiv').locale('uk', { weekStart: 1 });
      const startOfWeek = now.startOf('week');
      const scheduleKeyboardButtons = [];

      for (let i = 0; i < 5; i++) {
        const dayDate = startOfWeek.add(i, 'day');
        const dayName = [
          'Понеділок',
          'Вівторок',
          'Середа',
          'Четвер',
          "П'ятниця",
        ][i];
        const isToday = dayDate.isToday();

        const buttonText = `${dayName}${isToday ? ' (сьогодні)' : ''}`;
        const buttonData = `schedule:${dayDate.format('YYYY-MM-DD')}`;

        scheduleKeyboardButtons.push([
          InlineKeyboard.text(buttonText, buttonData),
        ]);
      }

      const userClass = user.class === 'CLASS_11A' ? '11a' : '11b';

      const [saturday, sunday] = await Promise.all([
        this.schedulesService.getSchedule(
          userClass,
          startOfWeek.day(6).format('YYYY-MM-DD'),
        ),
        this.schedulesService.getSchedule(
          userClass,
          startOfWeek.day(7).format('YYYY-MM-DD'),
        ),
      ]);

      if (saturday.length !== 0) {
        const saturdayDate = startOfWeek.day(6);
        const isToday = saturdayDate.isToday();

        const buttonText = `Субота ${isToday ? ' (сьогодні)' : ''}`;
        const buttonData = `schedule:${saturdayDate.format('YYYY-MM-DD')}`;

        scheduleKeyboardButtons.push([
          InlineKeyboard.text(buttonText, buttonData),
        ]);
      }

      if (sunday.length !== 0) {
        const sundayDate = startOfWeek.day(7);
        const isToday = sundayDate.isToday();

        const buttonText = `Неділя ${isToday ? ' (сьогодні)' : ''}`;
        const buttonData = `schedule:${sundayDate.format('YYYY-MM-DD')}`;

        scheduleKeyboardButtons.push([
          InlineKeyboard.text(buttonText, buttonData),
        ]);
      }

      if (now.day() === 0) {
        const startOfNextWeek = now.add(1, 'week').startOf('week');

        const buttonText = 'Наступний понеділок';
        const buttonData = `schedule:${startOfNextWeek.format('YYYY-MM-DD')}`;

        scheduleKeyboardButtons.push([
          InlineKeyboard.text(buttonText, buttonData),
        ]);
      }

      const scheduleKeyboard = InlineKeyboard.from(scheduleKeyboardButtons);

      await ctx.reply(scheduleText, { reply_markup: scheduleKeyboard });
    });
  }

  onScheduleCallbackQuery() {
    this.bot.callbackQuery(
      /^schedule:([0-9]{4}-[0-9]{2}-[0-9]{2})$/,
      async (ctx) => {
        if (!ctx.from) return;

        const userId = ctx.from.id;
        const user = await this.usersRepository.findUser(userId);

        if (!user) {
          const mainKeyboard = this.getMainKeyboard();

          await ctx.reply('Створи профіль за допомогою команди /start', {
            reply_markup: mainKeyboard,
          });

          return;
        }

        if (!user.class) {
          const classesText = 'Спочатку обери свій клас:';
          const classesKeyboard = new InlineKeyboard()
            .text('11-А', 'set-user-class:11a')
            .row()
            .text('11-Б', 'set-user-class:11b');

          await ctx.reply(classesText, { reply_markup: classesKeyboard });

          return;
        }

        const scheduleDate = ctx.match[1];
        const userClass = user.class === 'CLASS_11A' ? '11a' : '11b';
        const schedule = await this.schedulesService.getSchedule(
          userClass,
          scheduleDate,
        );

        const dayDate = dayjs(scheduleDate)
          .tz('Europe/Kyiv')
          .locale('uk', { weekStart: 1 });

        if (schedule.length === 0) {
          const dayNumber = dayjs(scheduleDate).day();
          const dayName = [
            'неділю',
            'понеділок',
            'вівторок',
            'середу',
            'четвер',
            "п'ятницю",
            'суботу',
          ][dayNumber];

          const noScheduleText = `Розклад на ${dayName} (${dayDate.format(
            'DD.MM.YYYY',
          )}) порожній.`;

          await ctx.editMessageText(noScheduleText);
          await ctx.answerCallbackQuery();

          return;
        }

        const dayNumber2 = dayjs(scheduleDate).day();
        const dayName2 = [
          'Неділя',
          'Понеділок',
          'Вівторок',
          'Середа',
          'Четвер',
          "П'ятниця",
          'Субота',
        ][dayNumber2];

        const dayText = `${
          dayDate.isToday()
            ? `${dayName2} (сьогодні)`
            : `${dayName2} (${dayDate.format('DD.MM.YYYY')})`
        }`;
        const lessonsText = schedule
          .map((lesson) => {
            const isNow = dayjs().isBetween(
              dayjs(lesson.startTime, 'HH:mm'),
              dayjs(lesson.endTime, 'HH:mm'),
              null,
              '[]',
            );

            const formattedStartTime = dayjs
              .utc(lesson.startTime, 'HH:mm')
              .tz('Europe/Kyiv')
              .locale('uk')
              .format('H:mm');
            const formattedEndTime = dayjs
              .utc(lesson.endTime, 'HH:mm')
              .tz('Europe/Kyiv')
              .format('H:mm');

            let formattedLesson = '';

            if (isNow) {
              formattedLesson = `<b>${lesson.number}. ${lesson.subjects
                .map(
                  (lessonSubject) =>
                    `${
                      lessonSubject.meetingUrl
                        ? `<a href="${lessonSubject.meetingUrl}">${lessonSubject.name}</a>`
                        : lessonSubject.name
                    } <i>(${formattedStartTime} - ${formattedEndTime})</i>`,
                )
                .join('\n     ')}</b>`;
            } else {
              formattedLesson = `${lesson.number}. ${lesson.subjects
                .map(
                  (lessonSubject) =>
                    `${
                      lessonSubject.meetingUrl
                        ? `<a href="${lessonSubject.meetingUrl}">${lessonSubject.name}</a>`
                        : lessonSubject.name
                    } <i>(${formattedStartTime} - ${formattedEndTime})</i>`,
                )
                .join('\n    ')}`;
            }

            return formattedLesson;
          })
          .join('\n');

        const updatedAt = await this.schedulesService.updatedAt(userClass);

        const now = dayjs().utc();
        const nzProblemsText =
          updatedAt && now.diff(dayjs(updatedAt), 'minute') >= 10
            ? `<b>⚠️ Увага! Проблеми з НЗ!</b>`
            : '';

        const scheduleText = `<b>${dayText}</b>\n${lessonsText}\n\n${nzProblemsText}`;

        await ctx.editMessageText(scheduleText, {
          link_preview_options: { is_disabled: true },
          parse_mode: 'HTML',
        });
        await ctx.answerCallbackQuery();
      },
    );
  }

  onProfileText() {
    this.bot.hears('👤 Профіль', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        const mainKeyboard = this.getMainKeyboard();

        await ctx.reply('Створи профіль за допомогою команди /start', {
          reply_markup: mainKeyboard,
        });

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
        const mainKeyboard = this.getMainKeyboard();

        await ctx.reply('Створи профіль за допомогою команди /start', {
          reply_markup: mainKeyboard,
        });

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
          const mainKeyboard = this.getMainKeyboard();

          await ctx.reply('Створи профіль за допомогою команди /start', {
            reply_markup: mainKeyboard,
          });

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
