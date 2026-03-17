const VALID_REPEAT_KINDS = new Set(["none", "daily", "workdays", "weekly", "monthly", "yearly"]);
const VALID_END_TYPES = new Set(["never", "onDate", "afterCount"]);
const VALID_MONTHLY_MODES = new Set(["dayOfMonth", "weekdayOfMonth"]);
const VALID_MONTHLY_WEEKS = new Set([1, 2, 3, 4, -1]);

function normalizeRepeatKind(value) {
  return VALID_REPEAT_KINDS.has(value) ? value : "none";
}

function normalizeEndType(value) {
  return VALID_END_TYPES.has(value) ? value : "never";
}

function normalizeWeekDays(value) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value
            .map((entry) => Number(entry))
            .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
        : []
    )
  ).sort((left, right) => left - right);
}

function normalizeMonthlyMode(value) {
  return VALID_MONTHLY_MODES.has(value) ? value : "dayOfMonth";
}

function normalizeMonthlyWeek(value) {
  const week = Number(value);
  return VALID_MONTHLY_WEEKS.has(week) ? week : 1;
}

function normalizeMonthlyWeekDay(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 7 ? day : null;
}

function getDayNumber(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildDate(year, monthIndex, day, source) {
  return new Date(
    year,
    monthIndex,
    Math.min(day, getDaysInMonth(year, monthIndex)),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );
}

function getWeekdayOfMonth(year, monthIndex, monthlyWeek, monthlyWeekDay, source) {
  if (!monthlyWeekDay) {
    return null;
  }

  if (monthlyWeek === -1) {
    const end = new Date(
      year,
      monthIndex + 1,
      0,
      source.getHours(),
      source.getMinutes(),
      source.getSeconds(),
      source.getMilliseconds()
    );

    while (getDayNumber(end) !== monthlyWeekDay) {
      end.setDate(end.getDate() - 1);
    }

    return end.getTime();
  }

  const start = new Date(
    year,
    monthIndex,
    1,
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );

  while (getDayNumber(start) !== monthlyWeekDay) {
    start.setDate(start.getDate() + 1);
  }

  start.setDate(start.getDate() + (monthlyWeek - 1) * 7);
  if (start.getMonth() !== monthIndex) {
    return null;
  }

  return start.getTime();
}

function getImmediateNextTargetAt(currentTargetAt, repeat) {
  const current = new Date(currentTargetAt);
  const anchor = new Date(repeat.anchorAt);

  switch (repeat.kind) {
    case "daily": {
      const candidate = new Date(current);
      candidate.setDate(candidate.getDate() + 1);
      return candidate.getTime();
    }
    case "workdays": {
      const candidate = new Date(current);
      do {
        candidate.setDate(candidate.getDate() + 1);
      } while (getDayNumber(candidate) > 5);
      return candidate.getTime();
    }
    case "weekly": {
      const selectedDays = repeat.weekDays.length > 0 ? repeat.weekDays : [getDayNumber(current)];
      for (let offset = 1; offset <= 14; offset += 1) {
        const candidate = new Date(current);
        candidate.setDate(candidate.getDate() + offset);
        if (selectedDays.includes(getDayNumber(candidate))) {
          return candidate.getTime();
        }
      }
      return null;
    }
    case "monthly": {
      const year = current.getMonth() === 11 ? current.getFullYear() + 1 : current.getFullYear();
      const monthIndex = (current.getMonth() + 1) % 12;

      if (repeat.monthlyMode === "weekdayOfMonth") {
        return getWeekdayOfMonth(year, monthIndex, repeat.monthlyWeek, repeat.monthlyWeekDay, anchor);
      }

      return buildDate(year, monthIndex, anchor.getDate(), anchor).getTime();
    }
    case "yearly": {
      return buildDate(current.getFullYear() + 1, anchor.getMonth(), anchor.getDate(), anchor).getTime();
    }
    default:
      return null;
  }
}

export function createStoredRepeat(value, anchorAt) {
  const kind = normalizeRepeatKind(value?.kind);
  const endType = kind === "none" ? "never" : normalizeEndType(value?.endType);

  return {
    kind,
    weekDays: kind === "weekly" ? normalizeWeekDays(value?.weekDays) : [],
    monthlyMode: kind === "monthly" ? normalizeMonthlyMode(value?.monthlyMode) : "dayOfMonth",
    monthlyWeek: kind === "monthly" ? normalizeMonthlyWeek(value?.monthlyWeek) : 1,
    monthlyWeekDay:
      kind === "monthly" && normalizeMonthlyMode(value?.monthlyMode) === "weekdayOfMonth"
        ? normalizeMonthlyWeekDay(value?.monthlyWeekDay)
        : null,
    endType,
    endAt: kind !== "none" && endType === "onDate" && Number.isFinite(Number(value?.endAt)) ? Number(value.endAt) : null,
    maxOccurrences:
      kind !== "none" && endType === "afterCount" && Number.isInteger(Number(value?.maxOccurrences))
        ? Number(value.maxOccurrences)
        : null,
    occurrenceCount: 1,
    anchorAt: Number.isFinite(Number(anchorAt)) ? Number(anchorAt) : Date.now(),
  };
}

export function normalizeStoredRepeat(value, fallbackTargetAt) {
  const repeat = createStoredRepeat(value, Number(value?.anchorAt) || fallbackTargetAt);
  return {
    ...repeat,
    occurrenceCount:
      Number.isInteger(Number(value?.occurrenceCount)) && Number(value.occurrenceCount) > 0
        ? Number(value.occurrenceCount)
        : 1,
    anchorAt: Number.isFinite(Number(value?.anchorAt)) ? Number(value.anchorAt) : fallbackTargetAt,
  };
}

export function advanceAlarm(alarm, referenceNow = Date.now()) {
  const now = Number(referenceNow);

  if (alarm.repeat.kind === "none") {
    return {
      ...alarm,
      status: "dismissed",
      acknowledgedAt: now,
      updatedAt: now,
    };
  }

  let occurrenceCount = alarm.repeat.occurrenceCount;
  let candidateTargetAt = alarm.targetAt;

  for (let guard = 0; guard < 500; guard += 1) {
    const nextTargetAt = getImmediateNextTargetAt(candidateTargetAt, alarm.repeat);
    if (!Number.isFinite(nextTargetAt)) {
      break;
    }

    occurrenceCount += 1;

    if (alarm.repeat.endType === "afterCount" && occurrenceCount > (alarm.repeat.maxOccurrences ?? 1)) {
      break;
    }
    if (alarm.repeat.endType === "onDate" && nextTargetAt > (alarm.repeat.endAt ?? 0)) {
      break;
    }
    if (nextTargetAt > now) {
      return {
        ...alarm,
        targetAt: nextTargetAt,
        status: "scheduled",
        acknowledgedAt: now,
        updatedAt: now,
        repeat: {
          ...alarm.repeat,
          occurrenceCount,
        },
      };
    }

    candidateTargetAt = nextTargetAt;
  }

  return {
    ...alarm,
    status: "dismissed",
    acknowledgedAt: now,
    updatedAt: now,
  };
}
