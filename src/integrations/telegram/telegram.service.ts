import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Class } from '@prisma/client';
import { Queue } from 'bull';
import dayjs from 'dayjs';
import { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard } from 'grammy';
import { AnalyticsRepository } from 'src/core/analytics/repositories/analytics.repository';
import { SchedulesService } from 'src/core/schedules/schedules.service';
import { SettingsRepository } from 'src/core/settings/repositories/settings.repository';
import { UsersRepository } from 'src/core/users/repositories/users.repository';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;
  private readonly superAdminId: number;

  constructor(
    @InjectQueue('message-distribution')
    private readonly messageDistributionQueue: Queue,
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly schedulesService: SchedulesService,
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const clientEnvironment = this.configService.getOrThrow<string>('NODE_ENV');

    this.bot = new Bot(token, {
      client: {
        environment: clientEnvironment === 'production' ? 'prod' : 'test',
      },
    });

    this.superAdminId = +configService.getOrThrow<number>(
      'TELEGRAM_SUPER_ADMIN_ID',
    );
  }

  onModuleInit() {
    // Commands
    this.onStartCommand();
    this.onUpdateCommand();

    // Texts
    this.onProfileText();
    this.onScheduleText();
    this.onAdminText();

    // Callback queries
    this.onModifyUserClassCallbackQuery();
    this.onSetOrChangeUserClassCallbackQuery();
    this.onScheduleCallbackQuery();
    this.onAdminUsersCallbackQuery();
    this.onAdminAnalyticsCallbackQuery();
    this.onAdminDistanceEducationCallbackQuery();
    this.onProfileLessonUpdatesCallbackQuery();

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
      if (!ctx.from) return;

      const userId = ctx.from.id;

      const welcomeText =
        'Привіт! Тут для тебе: розклад, конференції — все швидко та легко! 🚀';
      const mainKeyboard = this.getMainKeyboard(userId);

      await ctx.reply(welcomeText, { reply_markup: mainKeyboard });

      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        await this.usersRepository.createUser({ id: userId });
      }
    });
  }

  getMainKeyboard(userId: number | bigint) {
    const keyboard = new Keyboard()
      .text('📅 Розклад')
      .text('👤 Профіль')
      .row()
      .resized();

    if (this.superAdminId === userId) {
      keyboard.text('🔧 Адміністратор');
    }

    return keyboard;
  }

  onScheduleText() {
    this.bot.hears('📅 Розклад', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        const mainKeyboard = this.getMainKeyboard(userId);

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
          const mainKeyboard = this.getMainKeyboard(userId);

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
            const isNow = dayjs()
              .utc()
              .isBetween(
                `${scheduleDate} ${lesson.startTime}`,
                `${scheduleDate} ${lesson.endTime}`,
                null,
                '[]',
              );

            const formattedStartTime = dayjs
              .utc(lesson.startTime, 'HH:mm')
              .tz('Europe/Kyiv')
              .format('H:mm');
            const formattedEndTime = dayjs
              .utc(lesson.endTime, 'HH:mm')
              .tz('Europe/Kyiv')
              .format('H:mm');

            let formattedLesson = '';

            if (isNow) {
              formattedLesson =
                `<b>${lesson.number}-й урок (${formattedStartTime} - ${formattedEndTime})</b>\n` +
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
            } else {
              formattedLesson =
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
            }

            return formattedLesson;
          })
          .join('\n\n');

        const updatedAt = await this.schedulesService.updatedAt(userClass);

        const now = dayjs().utc();
        const nzProblemsText =
          updatedAt && now.diff(dayjs(updatedAt), 'minute') >= 10
            ? `<b>⚠️ Увага! Проблеми з НЗ!</b>`
            : '';

        const scheduleText = `<b>${dayText}</b>\n\n${lessonsText}\n\n${nzProblemsText}`;

        await ctx.editMessageText(scheduleText, {
          link_preview_options: { is_disabled: true },
          parse_mode: 'HTML',
        });
        await ctx.answerCallbackQuery();

        const analyticsScheduleDate = dayjs.utc(scheduleDate).toISOString();
        const analytics = await this.analyticsRepository.findAnalytics(
          user.class,
          analyticsScheduleDate,
        );

        if (!analytics) {
          await this.analyticsRepository.createAnalytics(
            user.class,
            analyticsScheduleDate,
          );
        } else {
          await this.analyticsRepository.updateAnalytics(
            user.class,
            analyticsScheduleDate,
          );
        }
      },
    );
  }

  onProfileText() {
    this.bot.hears('👤 Профіль', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        const mainKeyboard = this.getMainKeyboard(userId);

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

      const lessonUpdatesIndicator = user.isNotifyingLessonUpdates
        ? '✅'
        : '❌';
      const lessonUpdatesText = `${lessonUpdatesIndicator} Оновлення уроків`;

      const profileKeyboard = new InlineKeyboard()
        .text(modifyUserClassText, modifyUserClassData)
        .row()
        .text(lessonUpdatesText, 'profile:lesson-updates');

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
        const mainKeyboard = this.getMainKeyboard(userId);

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
          const mainKeyboard = this.getMainKeyboard(userId);

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

  onAdminText() {
    this.bot.hears('🔧 Адміністратор', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;

      if (this.superAdminId !== userId) {
        return;
      }

      const settings = await this.settingsRepository.findSettings();
      const { isDistanceEducation } =
        settings || (await this.settingsRepository.createSettings());

      const distanceEducationIndicator = isDistanceEducation ? '✅' : '❌';
      const distanceEducationText = `${distanceEducationIndicator} Дистанційне навчання`;

      const adminKeyboard = new InlineKeyboard()
        .text('👥 Користувачі', 'admin:users')
        .row()
        .text('📊 Аналітика', 'admin:analytics')
        .row()
        .text(distanceEducationText, 'admin:distance-education');

      await ctx.reply('Обери розділ:', { reply_markup: adminKeyboard });
    });
  }

  onAdminUsersCallbackQuery() {
    this.bot.callbackQuery('admin:users', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;

      if (this.superAdminId !== userId) {
        return;
      }

      const [
        class11aUsersCount,
        class11bUsersCount,
        noClassUsersCount,
        classesUsersCount,
      ] = await this.usersRepository.countClassesUsers();

      const usersText =
        '<b>Користувачі</b>' +
        `\n11-А: <code>${class11aUsersCount}</code>` +
        `\n11-Б: <code>${class11bUsersCount}</code>` +
        `\nБез класу: <code>${noClassUsersCount}</code>` +
        `\nЗагалом: <code>${classesUsersCount}</code>`;

      await ctx.editMessageText(usersText, { parse_mode: 'HTML' });
      await ctx.answerCallbackQuery();
    });
  }

  onAdminAnalyticsCallbackQuery() {
    this.bot.callbackQuery('admin:analytics', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;

      if (this.superAdminId !== userId) {
        return;
      }

      const [
        {
          _sum: { count: class11aAnalyticsCount },
        },
        {
          _sum: { count: class11bAnalyticsCount },
        },
        {
          _sum: { count: overallAnalyticsCount },
        },
      ] = await this.analyticsRepository.countAnalytics();

      const analyticsText =
        '<b>Аналітика</b>' +
        `\n11-А: <code>${class11aAnalyticsCount}</code>` +
        `\n11-Б: <code>${class11bAnalyticsCount}</code>` +
        `\nЗагалом: <code>${overallAnalyticsCount}</code>`;

      await ctx.editMessageText(analyticsText, { parse_mode: 'HTML' });
      await ctx.answerCallbackQuery();
    });
  }

  onAdminDistanceEducationCallbackQuery() {
    this.bot.callbackQuery('admin:distance-education', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;

      if (this.superAdminId !== userId) {
        return;
      }

      const settings = await this.settingsRepository.findSettings();
      const { id: settingsId, isDistanceEducation } =
        settings || (await this.settingsRepository.createSettings());

      const { isDistanceEducation: updatedIsDistanceEducation } =
        await this.settingsRepository.updateSettings(settingsId, {
          isDistanceEducation: !isDistanceEducation,
        });

      const distanceEducationIndicator = updatedIsDistanceEducation
        ? '✅'
        : '❌';
      const distanceEducationText = `${distanceEducationIndicator} Дистанційне навчання`;

      const adminKeyboard = new InlineKeyboard()
        .text('👥 Користувачі', 'admin:users')
        .row()
        .text('📊 Аналітика', 'admin:analytics')
        .row()
        .text(distanceEducationText, 'admin:distance-education');

      await ctx.editMessageReplyMarkup({ reply_markup: adminKeyboard });
      await ctx.answerCallbackQuery();
    });
  }

  onProfileLessonUpdatesCallbackQuery() {
    this.bot.callbackQuery('profile:lesson-updates', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;
      const user = await this.usersRepository.findUser(userId);

      if (!user) {
        const mainKeyboard = this.getMainKeyboard(userId);

        await ctx.reply('Створи профіль за допомогою команди /start', {
          reply_markup: mainKeyboard,
        });

        return;
      }

      const { isNotifyingLessonUpdates } =
        await this.usersRepository.updateUser(userId, {
          isNotifyingLessonUpdates: !user.isNotifyingLessonUpdates,
        });

      const modifyUserClassText = user.class
        ? 'Змінити клас'
        : 'Встановити клас';
      const modifyUserClassData = user.class
        ? 'change-user-class'
        : 'set-user-class';

      const lessonUpdatesIndicator = isNotifyingLessonUpdates ? '✅' : '❌';
      const lessonUpdatesText = `${lessonUpdatesIndicator} Оновлення уроків`;

      const profileKeyboard = new InlineKeyboard()
        .text(modifyUserClassText, modifyUserClassData)
        .row()
        .text(lessonUpdatesText, 'profile:lesson-updates');

      await ctx.editMessageReplyMarkup({ reply_markup: profileKeyboard });
      await ctx.answerCallbackQuery();
    });
  }

  onUpdateCommand() {
    this.bot.command('update', async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id;

      if (this.superAdminId !== userId) {
        return;
      }

      const users = await this.usersRepository.findUsersWithId();

      await this.messageDistributionQueue.addBulk(
        users.map((user) => ({
          data: { userId: user.id.toString() },
          name: 'update',
        })),
      );

      await ctx.reply('Розсилка успішна ✅');
    });
  }

  async sendMessage(userId: string, text: string) {
    try {
      const mainKeyboard = this.getMainKeyboard(Number(userId));

      await this.bot.api.sendMessage(userId, text, {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard,
      });
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.error_code === 403) {
          return;
        }
      }
    }
  }

  getSubjectForm(subjectName: string) {
    const subjectsForms: Record<string, string> = {
      алгебра: 'алгебри',
      'англійська мова': 'англійської мови',
      астрономія: 'астрономії',
      біологія: 'біології',
      географія: 'географії',
      геометрія: 'геометрії',
      'захист україни': 'захисту України',
      інформатика: 'інформатики',
      'історія україни': 'історії України',
      фізика: 'фізики',
      'фізична культура': 'фізичної культури',
      хімія: 'хімії',
      технології: 'технологій',
      'зарубіжна література': 'зарубіжної літератури',
    };

    const lowercaseSubjectName = subjectName.toLowerCase();
    const subjectForm = subjectsForms[lowercaseSubjectName];

    return subjectForm || null;
  }
}
