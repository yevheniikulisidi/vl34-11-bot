buttons =
  .start = Розпочати 🚀
  .schedule = 📅 Розклад
  .profile = 👤 Профіль

start-text =
  Привіт! Тут для вас: розклад, конференції — все швидко та зручно! 🚀

  Детальніше /info

info-text =
  Бот для 11-А та 11-Б класів Вінницького ліцею №34, розроблений Кулісіді Є. С.

  Основні можливості бота:
  - Швидке та зручне отримання розкладу.
  - Одним кліком приєднуйтесь до онлайн-уроків прямо з розкладу.
  - Миттєві сповіщення про будь-які зміни в розкладі.
  - Щоденний розклад уроків автоматично о 7:30 ранку.

  Звертайтесь за допомогою контакту @kulisidi при будь-яких питаннях чи проблемах.

specify-class-text = Оберіть свій клас:
specify-class-keyboard =
  .class-11a = 11-А
  .class-11b = 11-Б
modified-class-text = { $action ->
  [specify] ✅ Клас успішно вказано як { $class -> 
    [CLASS_11A] 11-А
    *[CLASS_11B] 11-Б
  }!
  *[change] Клас успішно змінено!
}
modified-class-text2 = Тепер Ви можете користуватися ботом 🙂

schedule-text = Оберіть день тижня:
schedule-keyboard =
  .monday = { $isToday ->
    [true] Понеділок (сьогодні)
    *[false] Понеділок
  }
  .tuesday = { $isToday ->
    [true] Вівторок (сьогодні)
    *[false] Вівторок
  }
  .wednesday = { $isToday ->
    [true] Середа (сьогодні)
    *[false] Середа
  }
  .thursday = { $isToday ->
    [true] Четвер (сьогодні)
    *[false] Четвер
  }
  .friday = { $isToday ->
    [true] П'ятниця (сьогодні)
    *[false] П'ятниця
  }
  .saturday = { $isToday ->
    [true] Субота (сьогодні)
    *[false] Субота
  }
  .sunday = { $isToday ->
    [true] Неділя (сьогодні)
    *[false] Неділя
  }
  .next-monday = Наступний понеділок

no-schedule-lessons = { $weekdayName ->
  [monday] Розклад на понеділок порожній.
  [tuesday] Розклад на вівторок порожній.
  [wednesday] Розклад на середу порожній.
  [thursday] Розклад на четвер порожній.
  [friday] Розклад на п'ятницю порожній.
  [saturday] Розклад на суботу порожній.
  [sunday] Розклад на неділю порожній.
  *[next-monday] Розклад на наступний понеділок порожній.
}
schedule-lessons-text =
  .lesson = { $lessonNumber }-й урок ({ $lessonStartTime } - { $lessonEndTime })
  .lesson-bold = <b>{ $lessonNumber }-й урок ({ $lessonStartTime } - { $lessonEndTime })</b>
  .subject = { $isSubjectMeetingUrl ->
    [true] <a href="{ $subjectMeetingUrl }">- { $subjectName } ({ $subjectTeacherName })</a>
    *[false] - { $subjectName } ({ $subjectTeacherName })
  }
  .dfsdf  = https://dsfsdfds.com
  .lessons-result =
    { $scheduleLessonText }
    { $scheduleLessonSujectsText }
  .result =
  <b>{ $weekdayName ->
    [monday] { $isToday ->
      [true] Понеділок (сьогодні)
      *[false] Понеділок ({ $weekdayDate })
    }
    [tuesday] { $isToday ->
      [true] Вівторок (сьогодні)
      *[false] Вівторок ({ $weekdayDate })
    }
    [wednesday] { $isToday ->
      [true] Середа (сьогодні)
      *[false] Середа ({ $weekdayDate })
    }
    [thursday] { $isToday ->
      [true] Четвер (сьогодні)
      *[false] Четвер ({ $weekdayDate })
    }
    [friday] { $isToday ->
      [true] П'ятниця (сьогодні)
      *[false] П'ятниця ({ $weekdayDate })
    }
    [saturday] { $isToday ->
      [true] Субота (сьогодні)
      *[false] Субота ({ $weekdayDate })
    }
    [sunday] { $isToday ->
      [true] Неділя (сьогодні)
      *[false] Неділя ({ $weekdayDate })
    }
    *[next-monday] Наступний понеділок (завтра)
    }</b>

  { $scheduleLessonsText }

profile-text =
  <b>Профіль</b>
  ID: <code>{ $id }</code>
  Клас: <code>{ $class -> 
    [CLASS_11A] 11-А
    *[CLASS_11B] 11-Б
  }</code>
  Створений: <code>{ $createdAt }</code>
profile-keyboard =
  .change-class = Змінити клас
  .lesson-updates-button = { $isNotifyingLessonUpdates ->
    [true] ✅ Оновлення уроків
    *[false] ❌ Оновлення уроків
  }
  .daily-schedule-button = { $isGettingDailySchedule ->
    [true] ✅ Щоденний розклад
    *[false] ❌ Щоденний розклад
  }

profile =
  .updated-lesson-updates-text = { $isNotifyingLessonUpdates ->
    [true] Сповіщення про оновлення уроків увімкнено!
    *[false] Сповіщення про оновлення уроків вимкнено!
  }
  .updated-daily-schedule-text = { $isGettingDailySchedule ->
    [true] Отримання щоденного розкладу увімкнено!
    *[false] Отримання щоденного розкладу вимкнено!
  }