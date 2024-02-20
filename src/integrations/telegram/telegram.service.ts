import { I18n, hears } from '@grammyjs/i18n';
import { hydrateReply, parseMode } from '@grammyjs/parse-mode';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { Queue } from 'bull';
import dayjs from 'dayjs';
import { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard } from 'grammy';
import { join } from 'path';
import { AnalyticsRepository } from 'src/core/analytics/repositories/analytics.repository';
import { ScheduleLesson } from 'src/core/schedules/interfaces/schedule.interface';
import { SchedulesService } from 'src/core/schedules/schedules.service';
import { SettingsRepository } from 'src/core/settings/repositories/settings.repository';
import { UsersRepository } from 'src/core/users/repositories/users.repository';
import { MyContext } from './types/my-context.type';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot<MyContext>;
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

    this.bot = new Bot<MyContext>(token, {
      client: {
        environment: clientEnvironment === 'production' ? 'prod' : 'test',
      },
    });

    this.superAdminId = +this.configService.getOrThrow<number>(
      'TELEGRAM_SUPER_ADMIN_ID',
    );
  }

  onModuleInit() {
    this.bot.use(hydrateReply);

    this.bot.api.config.use(parseMode('HTML'));

    const i18n = new I18n<MyContext>({
      defaultLocale: 'uk',
      directory: join(__dirname, 'locales'),
    });

    this.bot.use(i18n);

    // Starting functions
    this.onStartCommand();
    this.onInfoCommand();
    this.onStartButton();
    this.onSpecifyClassCallbackQuery();

    // Schedule functions
    this.onScheduleButton();
    this.onScheduleCallbackQuery();

    // Profile functions
    this.onProfileButton();
    this.onProfileChangeClassCallbackQuery();
    this.onProfileLessonUpdatesCallbackQuery();
    this.onProfileDailyScheduleCallbackQuery();

    // Admin panel functions
    this.onAdminPanelButton();
    this.onAdminPanelDistanceEducationCallbackQuery();

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

  private onStartCommand() {
    this.bot.chatType('private').command('start', async (ctx) => {
      const user = await this.usersRepository.findUser(ctx.from.id, {
        id: true,
      });

      let keyboard;

      if (!user) {
        keyboard = Keyboard.from([[Keyboard.text(ctx.t('buttons.start'))]])
          .oneTime()
          .resized();
      } else {
        keyboard = Keyboard.from([
          [
            Keyboard.text(ctx.t('buttons.schedule')),
            Keyboard.text(ctx.t('buttons.profile')),
          ],
        ]).resized();
      }

      if (ctx.from.id === this.superAdminId) {
        keyboard.append([[Keyboard.text(ctx.t('buttons.admin-panel'))]]);
      }

      await ctx.reply(ctx.t('start-text'), { reply_markup: keyboard });
    });
  }

  private onInfoCommand() {
    this.bot.chatType('private').command('info', async (ctx) => {
      await ctx.reply(ctx.t('info-text'));
    });
  }

  private onStartButton() {
    this.bot.chatType('private').filter(hears('buttons.start'), async (ctx) => {
      const user = await this.usersRepository.findUser(ctx.from.id, {
        id: true,
      });

      if (!user) {
        const specifyClassKeyboard = InlineKeyboard.from([
          [
            InlineKeyboard.text(
              ctx.t('specify-class-keyboard.class-11a'),
              'specify-class:11a',
            ),
          ],
          [
            InlineKeyboard.text(
              ctx.t('specify-class-keyboard.class-11b'),
              'specify-class:11b',
            ),
          ],
        ]);

        await ctx.reply(ctx.t('specify-class-text'), {
          reply_markup: specifyClassKeyboard,
        });
      }
    });
  }

  private onSpecifyClassCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery(/^specify-class:(11a|11b)$/, async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          id: true,
        });

        const userClass = ctx.match[1] === '11a' ? 'CLASS_11A' : 'CLASS_11B';

        if (!user) {
          const createdUser = await this.usersRepository.createUser(
            {
              id: ctx.from.id,
              class: userClass,
            },
            { class: true },
          );

          await ctx.editMessageText(
            ctx.t('modified-class-text', {
              action: 'specify',
              class: createdUser.class,
            }),
          );

          const keyboard = Keyboard.from([
            [
              Keyboard.text(ctx.t('buttons.schedule')),
              Keyboard.text(ctx.t('buttons.profile')),
            ],
          ]).resized();

          await ctx.reply(ctx.t('modified-class-text2'), {
            reply_markup: keyboard,
          });
        }

        await ctx.answerCallbackQuery();
      });
  }

  private onScheduleButton() {
    this.bot
      .chatType('private')
      .filter(hears('buttons.schedule'), async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          class: true,
        });

        if (!user) return;

        const currentWeekStart = dayjs
          .utc()
          .tz('Europe/Kyiv')
          .locale('uk', { weekStart: 1 })
          .startOf('week');
        const nextWeekStart = currentWeekStart.add(1, 'week').startOf('week');
        const weekdays = [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
        ];
        const scheduleClass = user.class === 'CLASS_11A' ? '11a' : '11b';

        const createKeyboardRow = (
          weekdayName: string,
          weekdayNumber: number,
          isToday: boolean,
        ) => {
          return [
            InlineKeyboard.text(
              ctx.t(`schedule-keyboard.${weekdayName}`, {
                isToday: String(isToday),
              }),
              `schedule:${currentWeekStart
                .day(weekdayNumber)
                .format('YYYY-MM-DD')}`,
            ),
          ];
        };

        const keyboard = InlineKeyboard.from(
          weekdays.map((weekdayName: string, weekdayNumber: number) =>
            createKeyboardRow(
              weekdayName,
              weekdayNumber + 1,
              currentWeekStart.day(weekdayNumber + 1).isToday(),
            ),
          ),
        );

        const addSpecialDays = (
          weekdayName: string,
          weekdayNumber: number,
          scheduleLessons: ScheduleLesson[],
        ) => {
          if (scheduleLessons.length > 0) {
            keyboard.row(
              InlineKeyboard.text(
                ctx.t(`schedule-keyboard.${weekdayName}`, {
                  isToday: String(
                    currentWeekStart.day(weekdayNumber).isToday(),
                  ),
                }),
                `schedule:${currentWeekStart
                  .day(weekdayNumber)
                  .format('YYYY-MM-DD')}`,
              ),
            );
          }
        };

        addSpecialDays(
          'saturday',
          6,
          await this.schedulesService.findScheduleLessons(
            scheduleClass,
            currentWeekStart.day(6).format('YYYY-MM-DD'),
          ),
        );
        addSpecialDays(
          'sunday',
          7,
          await this.schedulesService.findScheduleLessons(
            scheduleClass,
            currentWeekStart.day(7).format('YYYY-MM-DD'),
          ),
        );

        if (currentWeekStart.day(7).isToday()) {
          keyboard.row(
            InlineKeyboard.text(
              ctx.t('schedule-keyboard.next-monday'),
              `schedule:${nextWeekStart.day(1).format('YYYY-MM-DD')}`,
            ),
          );
        }

        await ctx.reply(ctx.t('schedule-text'), { reply_markup: keyboard });
      });
  }

  private onScheduleCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery(/^schedule:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          class: true,
        });

        if (!user) {
          await ctx.answerCallbackQuery();
          return;
        }

        const scheduleClass = user.class === 'CLASS_11A' ? '11a' : '11b';
        const scheduleDate = dayjs.utc(ctx.match[1]).tz('Europe/Kyiv');
        const scheduleLessons = await this.schedulesService.findScheduleLessons(
          scheduleClass,
          scheduleDate.format('YYYY-MM-DD'),
        );

        const nextMondayDate = dayjs
          .utc()
          .tz('Europe/Kyiv')
          .locale('uk', { weekStart: 1 })
          .startOf('week')
          .add(1, 'week')
          .startOf('week')
          .format('YYYY-MM-DD');
        const isNextMonday =
          scheduleDate.format('YYYY-MM-DD') === nextMondayDate;

        if (!scheduleLessons.length) {
          await ctx.answerCallbackQuery(
            ctx.t('no-schedule-lessons', {
              weekdayName: isNextMonday
                ? 'next-monday'
                : scheduleDate.format('dddd').toLocaleLowerCase(),
            }),
          );
          return;
        }

        const settings =
          (await this.settingsRepository.findSettings({
            isDistanceEducation: true,
          })) ||
          (await this.settingsRepository.createSettings({
            isDistanceEducation: true,
          }));

        const scheduleLessonsText = this.scheduleLessonsText(
          ctx,
          scheduleDate.format('YYYY-MM-DD'),
          scheduleLessons,
          settings.isDistanceEducation,
        );

        const updatedAtSchedule =
          await this.schedulesService.getUpdatedAtSchedule(scheduleClass);

        const isNzProblems = updatedAtSchedule
          ? dayjs.utc().diff(dayjs.utc(updatedAtSchedule), 'minute') >= 10
          : null;

        const analytics = await this.analyticsRepository.findAnalytics(
          user.class,
          scheduleDate.toISOString(),
        );

        if (!analytics) {
          await this.analyticsRepository.createAnalytics(
            user.class,
            scheduleDate.toISOString(),
          );
        } else {
          await this.analyticsRepository.updateAnalytics(
            user.class,
            scheduleDate.toISOString(),
          );
        }

        const lastUpdatedAtSchedule = dayjs
          .utc(updatedAtSchedule)
          .tz('Europe/Kyiv')
          .locale('uk')
          .format('DD.MM.YYYY о HH:mm');
        const nzProblemsText = isNzProblems
          ? `\n\n<b>⚠️ Увага! Розклад оновлено ${lastUpdatedAtSchedule}!</b>`
          : '';

        await ctx.editMessageText(
          ctx.t('schedule-lessons-text.result', {
            weekdayName: isNextMonday
              ? 'next-monday'
              : scheduleDate.format('dddd').toLocaleLowerCase(),
            isToday: String(scheduleDate.isToday()),
            weekdayDate: scheduleDate.format('DD.MM.YYYY'),
            scheduleLessonsText,
          }) + nzProblemsText,
          { link_preview_options: { is_disabled: true } },
        );
        await ctx.answerCallbackQuery();
      });
  }

  private scheduleLessonsText(
    ctx: MyContext,
    scheduleDate: string,
    scheduleLessons: ScheduleLesson[],
    isDistanceEducation: boolean,
  ) {
    return scheduleLessons
      .map((scheduleLesson) => {
        const isOnlineLesson = scheduleLesson.subjects.some(
          (scheduleLessonSubject) => scheduleLessonSubject.meetingUrl !== null,
        );

        const scheduleLessonStartTime = dayjs.utc(
          `${scheduleDate} ${scheduleLesson.startTime}`,
          'YYYY-MM-DD HH:mm',
        );
        const scheduleLessonEndTime = dayjs.utc(
          `${scheduleDate} ${scheduleLesson.endTime}`,
          'YYYY-MM-DD HH:mm',
        );
        const isNow = dayjs()
          .utc()
          .isBetween(
            scheduleLessonStartTime,
            scheduleLessonEndTime,
            null,
            '[]',
          );

        let scheduleLessonText;

        const scheduleLessonSujectsText = scheduleLesson.subjects
          .map((scheduleLessonSubject) => {
            const scheduleLessonSujectText = scheduleLessonSubject.meetingUrl
              ? `<a href="${scheduleLessonSubject.meetingUrl}">- ${scheduleLessonSubject.name} (${scheduleLessonSubject.teacherName})</a>`
              : `- ${scheduleLessonSubject.name} (${scheduleLessonSubject.teacherName})`;

            return scheduleLessonSujectText;
          })
          .join('\n');

        if (isDistanceEducation && isOnlineLesson && isNow) {
          scheduleLessonText = ctx.t('schedule-lessons-text.lesson-bold', {
            lessonNumber: scheduleLesson.number.toString(),
            lessonStartTime: scheduleLessonStartTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
            lessonEndTime: scheduleLessonEndTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
          });
        } else if (isDistanceEducation && !isOnlineLesson) {
          scheduleLessonText = ctx.t('schedule-lessons-text.lesson', {
            lessonNumber: scheduleLesson.number.toString(),
            lessonStartTime: scheduleLessonStartTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
            lessonEndTime: scheduleLessonEndTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
          });
        } else if (!isDistanceEducation && isNow) {
          scheduleLessonText = ctx.t('schedule-lessons-text.lesson-bold', {
            lessonNumber: scheduleLesson.number.toString(),
            lessonStartTime: scheduleLessonStartTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
            lessonEndTime: scheduleLessonEndTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
          });
        } else if (!isDistanceEducation && !isNow) {
          scheduleLessonText = ctx.t('schedule-lessons-text.lesson', {
            lessonNumber: scheduleLesson.number.toString(),
            lessonStartTime: scheduleLessonStartTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
            lessonEndTime: scheduleLessonEndTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
          });
        } else {
          scheduleLessonText = ctx.t('schedule-lessons-text.lesson', {
            lessonNumber: scheduleLesson.number.toString(),
            lessonStartTime: scheduleLessonStartTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
            lessonEndTime: scheduleLessonEndTime
              .tz('Europe/Kyiv')
              .format('H:mm'),
          });
        }

        return ctx.t('schedule-lessons-text.lessons-result', {
          scheduleLessonText,
          scheduleLessonSujectsText,
        });
      })
      .join('\n\n');
  }

  private onProfileButton() {
    this.bot
      .chatType('private')
      .filter(hears('buttons.profile'), async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          id: true,
          class: true,
          isNotifyingLessonUpdates: true,
          isGettingDailySchedule: true,
          createdAt: true,
        });

        if (!user) return;

        const { text: profileText, keyboard: profileKeyboard } = this.profile(
          ctx,
          user,
        );

        await ctx.reply(profileText, { reply_markup: profileKeyboard });
      });
  }

  private profile(ctx: MyContext, user: Omit<User, 'updatedAt'>) {
    const text = ctx.t('profile-text', {
      id: user.id.toString(),
      class: user.class,
      createdAt: dayjs
        .utc(user.createdAt)
        .tz('Europe/Kyiv')
        .format('DD.MM.YYYY'),
    });

    const keyboard = InlineKeyboard.from([
      [
        InlineKeyboard.text(
          ctx.t('profile-keyboard.change-class'),
          'profile:change-class',
        ),
      ],
      [
        InlineKeyboard.text(
          ctx.t('profile-keyboard.lesson-updates-button', {
            isNotifyingLessonUpdates: String(user.isNotifyingLessonUpdates),
          }),
          'profile:lesson-updates',
        ),
      ],
      [
        InlineKeyboard.text(
          ctx.t('profile-keyboard.daily-schedule-button', {
            isGettingDailySchedule: String(user.isGettingDailySchedule),
          }),
          'profile:daily-schedule',
        ),
      ],
    ]);

    return { text, keyboard };
  }

  private onProfileChangeClassCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery('profile:change-class', async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          class: true,
        });

        if (!user) {
          await ctx.answerCallbackQuery();
          return;
        }

        const updatedUser = await this.usersRepository.updateUser(
          ctx.from.id,
          {
            class: user.class === 'CLASS_11A' ? 'CLASS_11B' : 'CLASS_11A',
          },
          {
            id: true,
            class: true,
            isNotifyingLessonUpdates: true,
            isGettingDailySchedule: true,
            createdAt: true,
          },
        );

        const { text: profileText, keyboard: profileKeyboard } = this.profile(
          ctx,
          updatedUser,
        );

        await ctx.editMessageText(profileText, {
          reply_markup: profileKeyboard,
        });
        await ctx.answerCallbackQuery(
          ctx.t('modified-class-text', { action: 'change' }),
        );
      });
  }

  private onProfileLessonUpdatesCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery('profile:lesson-updates', async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          isNotifyingLessonUpdates: true,
        });

        if (!user) {
          await ctx.answerCallbackQuery();
          return;
        }

        const updatedUser = await this.usersRepository.updateUser(
          ctx.from.id,
          {
            isNotifyingLessonUpdates: !user.isNotifyingLessonUpdates,
          },
          {
            id: true,
            class: true,
            isNotifyingLessonUpdates: true,
            isGettingDailySchedule: true,
            createdAt: true,
          },
        );

        const { keyboard: profileKeyboard } = this.profile(ctx, updatedUser);

        await ctx.editMessageReplyMarkup({ reply_markup: profileKeyboard });
        await ctx.answerCallbackQuery(
          ctx.t('profile.updated-lesson-updates-text', {
            isNotifyingLessonUpdates: String(
              updatedUser.isNotifyingLessonUpdates,
            ),
          }),
        );
      });
  }

  private onProfileDailyScheduleCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery('profile:daily-schedule', async (ctx) => {
        const user = await this.usersRepository.findUser(ctx.from.id, {
          isGettingDailySchedule: true,
        });

        if (!user) {
          await ctx.answerCallbackQuery();
          return;
        }

        const updatedUser = await this.usersRepository.updateUser(
          ctx.from.id,
          {
            isGettingDailySchedule: !user.isGettingDailySchedule,
          },
          {
            id: true,
            class: true,
            isNotifyingLessonUpdates: true,
            isGettingDailySchedule: true,
            createdAt: true,
          },
        );

        if (updatedUser.isGettingDailySchedule) {
          await this.messageDistributionQueue.add(
            'daily-schedule',
            { userId: ctx.from.id },
            {
              jobId: ctx.from.id,
              repeat: { cron: '30 7 * * *', tz: 'Europe/Kyiv' },
            },
          );
        } else {
          await this.messageDistributionQueue.removeRepeatable(
            'daily-schedule',
            {
              jobId: ctx.from.id,
              cron: '30 7 * * *',
              tz: 'Europe/Kyiv',
            },
          );
        }

        const { keyboard: profileKeyboard } = this.profile(ctx, updatedUser);

        await ctx.editMessageReplyMarkup({ reply_markup: profileKeyboard });
        await ctx.answerCallbackQuery(
          ctx.t('profile.updated-daily-schedule-text', {
            isGettingDailySchedule: String(updatedUser.isGettingDailySchedule),
          }),
        );
      });
  }

  async sendMessage(userId: string, text: string) {
    try {
      // const mainKeyboard = this.getMainKeyboard(Number(userId));

      await this.bot.api.sendMessage(userId, text, {
        link_preview_options: { is_disabled: true },
        parse_mode: 'HTML',
        // reply_markup: mainKeyboard,
      });
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.error_code === 403) {
          return;
        }
      }
    }
  }

  private onAdminPanelButton() {
    this.bot
      .chatType('private')
      .filter(hears('buttons.admin-panel'), async (ctx) => {
        if (ctx.from.id !== this.superAdminId) {
          return;
        }

        const settings =
          (await this.settingsRepository.findSettings({
            isDistanceEducation: true,
          })) ||
          (await this.settingsRepository.createSettings({
            isDistanceEducation: true,
          }));

        const keyboard = new InlineKeyboard().text(
          ctx.t('admin-panel-keyboard.distance-education-button', {
            isDistanceEducation: String(settings.isDistanceEducation),
          }),
          'admin-panel:distance-education',
        );

        await ctx.reply(ctx.t('admin-panel-text'), { reply_markup: keyboard });
      });
  }

  private onAdminPanelDistanceEducationCallbackQuery() {
    this.bot
      .chatType('private')
      .callbackQuery('admin-panel:distance-education', async (ctx) => {
        if (ctx.from.id !== this.superAdminId) {
          return;
        }

        const settings =
          (await this.settingsRepository.findSettings({
            id: true,
            isDistanceEducation: true,
          })) ||
          (await this.settingsRepository.createSettings({
            id: true,
            isDistanceEducation: true,
          }));

        const updatedSettings = await this.settingsRepository.updateSettings(
          settings.id,
          { isDistanceEducation: !settings.isDistanceEducation },
        );

        const keyboard = new InlineKeyboard().text(
          ctx.t('admin-panel-keyboard.distance-education-button', {
            isDistanceEducation: String(updatedSettings.isDistanceEducation),
          }),
          'admin-panel:distance-education',
        );

        await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        await ctx.answerCallbackQuery(
          ctx.t('admin-panel.updated-distance-education-text', {
            isDistanceEducation: String(updatedSettings.isDistanceEducation),
          }),
        );
      });
  }
}
