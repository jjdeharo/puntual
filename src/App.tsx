import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { ca, enUS, es } from "date-fns/locale";
import { Bell, BellOff, Clock3, ExternalLink, Info, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import "./App.css";
import type { Alarm, AlarmRepeat, AlarmRepeatEndType, AlarmRepeatInput, AlarmRepeatKind, AlarmState, AppLocale } from "./types";

const ALARM_SOUND_PATH =
  "file:///home/jjdeharo/Documentos/github/escritorio-digital.github.io/dist/sounds/alarm-clock-elapsed.oga";

const fallbackState: AlarmState = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
    locale: "system",
  },
};

const APP_VERSION = __APP_VERSION__;
const APP_LICENSE = __APP_LICENSE__;
const APP_REPOSITORY = __APP_REPOSITORY__;
const LATEST_RELEASE_API = "https://api.github.com/repos/jjdeharo/puntual/releases/latest";

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date"; version: string }
  | { kind: "available"; version: string; url: string }
  | { kind: "error"; message: string };

const DATE_FNS_LOCALES = {
  es,
  ca,
  en: enUS,
} as const;

const LOCALE_LABELS: Record<AppLocale, { es: string; ca: string; en: string }> = {
  system: { es: "Automático", ca: "Automàtic", en: "Automatic" },
  es: { es: "Español", ca: "Espanyol", en: "Spanish" },
  ca: { es: "Catalán", ca: "Català", en: "Catalan" },
  en: { es: "Inglés", ca: "Anglès", en: "English" },
};

const WEEKDAY_OPTIONS = [
  { value: 1, es: "L", ca: "Dl", en: "Mo" },
  { value: 2, es: "M", ca: "Dt", en: "Tu" },
  { value: 3, es: "X", ca: "Dc", en: "We" },
  { value: 4, es: "J", ca: "Dj", en: "Th" },
  { value: 5, es: "V", ca: "Dv", en: "Fr" },
  { value: 6, es: "S", ca: "Ds", en: "Sa" },
  { value: 7, es: "D", ca: "Dg", en: "Su" },
] as const;

const MESSAGES = {
  es: {
    now: "Ahora",
    today: "Hoy",
    tomorrow: "Mañana",
    preview: "Vista previa: {value}",
    noNextAlarm: "Sin próxima alarma",
    ringing: "Sonando",
    waiting: "En espera",
    noAlarms: "Sin alarmas",
    editAlarm: "Editar alarma",
    newAlarm: "Nueva alarma",
    title: "Título",
    countdown: "Cuenta atrás",
    dateTime: "Fecha y hora",
    date: "Fecha",
    time: "Hora",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "Sonido",
    silent: "Silencio",
    repeat: "Repetir",
    noRepeat: "No repetir",
    repeatDaily: "Cada día",
    repeatWorkdays: "Días laborables",
    repeatWeekly: "Semanalmente",
    repeatMonthly: "Mensualmente",
    repeatYearly: "Anualmente",
    repeatDays: "Días",
    ends: "Finaliza",
    never: "Nunca",
    endsOnDate: "En fecha",
    endsAfter: "Tras repeticiones",
    occurrences: "Veces",
    noEndDate: "sin fecha de fin",
    until: "hasta",
    notes: "Notas",
    cancel: "Cancelar",
    save: "Guardar",
    add: "Añadir",
    activeAlarms: "Alarmas activas",
    noActiveAlarms: "Sin alarmas activas.",
    untitled: "Sin título",
    muted: "Muda",
    edit: "Editar",
    ringingSection: "Sonando",
    nothingActive: "Nada activo.",
    dismiss: "Descartar",
    about: "Acerca de",
    settings: "Configuración",
    close: "Cerrar",
    aboutTitle: "Acerca de Puntual",
    aboutText: "Alarma de escritorio con bandeja, persistencia real y cuenta atrás que sobrevive a cierres y reinicios.",
    version: "Versión",
    license: "Licencia",
    repository: "Repositorio",
    openRepo: "Abrir repo",
    downloads: "Descargas",
    checkUpdates: "Buscar actualizaciones",
    checkingUpdates: "Consultando la última release publicada...",
    checkUpdatesFailed: "No se pudo comprobar si hay actualizaciones.",
    invalidReleaseData: "GitHub no devolvió una versión válida.",
    upToDate: "Estás al día. Última versión publicada: {version}.",
    updateAvailable: "Hay una versión más reciente: {version}.",
    openRelease: "Abrir release",
    settingsTitle: "Configuración",
    appLanguage: "Idioma de la app",
    systemLanguage: "Idioma detectado del sistema: {language}.",
    launchAtLogin: "Iniciar Puntual con el sistema",
    launchAtLoginHelp: "Abre la aplicación al iniciar sesión y la deja minimizada en la bandeja.",
    invalidCountdown: "Cuenta atrás inválida.",
    invalidDate: "Fecha inválida.",
    invalidRepeatDays: "Selecciona al menos un día.",
    invalidEndDate: "Fecha de fin inválida.",
    invalidRepeatCount: "Número de repeticiones inválido.",
    saveFailed: "No se pudo guardar.",
  },
  ca: {
    now: "Ara",
    today: "Avui",
    tomorrow: "Demà",
    preview: "Vista prèvia: {value}",
    noNextAlarm: "Sense pròxima alarma",
    ringing: "Sonant",
    waiting: "En espera",
    noAlarms: "Sense alarmes",
    editAlarm: "Edita alarma",
    newAlarm: "Nova alarma",
    title: "Títol",
    countdown: "Compte enrere",
    dateTime: "Data i hora",
    date: "Data",
    time: "Hora",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "So",
    silent: "Silenci",
    repeat: "Repeteix",
    noRepeat: "No es repeteix",
    repeatDaily: "Cada dia",
    repeatWorkdays: "Dies feiners",
    repeatWeekly: "Setmanalment",
    repeatMonthly: "Mensualment",
    repeatYearly: "Anualment",
    repeatDays: "Dies",
    ends: "Finalitza",
    never: "Mai",
    endsOnDate: "En data",
    endsAfter: "Després de repeticions",
    occurrences: "Vegades",
    noEndDate: "sense data de fi",
    until: "fins al",
    notes: "Notes",
    cancel: "Cancel·la",
    save: "Desa",
    add: "Afegeix",
    activeAlarms: "Alarmes actives",
    noActiveAlarms: "No hi ha alarmes actives.",
    untitled: "Sense títol",
    muted: "Muda",
    edit: "Edita",
    ringingSection: "Sonant",
    nothingActive: "No hi ha res actiu.",
    dismiss: "Descarta",
    about: "Quant a",
    settings: "Configuració",
    close: "Tanca",
    aboutTitle: "Quant a Puntual",
    aboutText: "Alarma d'escriptori amb safata, persistència real i compte enrere que sobreviu a tancaments i reinicis.",
    version: "Versió",
    license: "Llicència",
    repository: "Repositori",
    openRepo: "Obre el repo",
    downloads: "Descàrregues",
    checkUpdates: "Comprova actualitzacions",
    checkingUpdates: "Consultant l'última release publicada...",
    checkUpdatesFailed: "No s'ha pogut comprovar si hi ha actualitzacions.",
    invalidReleaseData: "GitHub no ha retornat una versió vàlida.",
    upToDate: "Ja està al dia. Última versió publicada: {version}.",
    updateAvailable: "Hi ha una versió més recent: {version}.",
    openRelease: "Obre la release",
    settingsTitle: "Configuració",
    appLanguage: "Idioma de l'app",
    systemLanguage: "Idioma detectat del sistema: {language}.",
    launchAtLogin: "Inicia Puntual amb el sistema",
    launchAtLoginHelp: "Obre l'aplicació en iniciar sessió i la deixa minimitzada a la safata.",
    invalidCountdown: "Compte enrere invàlid.",
    invalidDate: "Data invàlida.",
    invalidRepeatDays: "Selecciona almenys un dia.",
    invalidEndDate: "Data de fi invàlida.",
    invalidRepeatCount: "Nombre de repeticions invàlid.",
    saveFailed: "No s'ha pogut desar.",
  },
  en: {
    now: "Now",
    today: "Today",
    tomorrow: "Tomorrow",
    preview: "Preview: {value}",
    noNextAlarm: "No upcoming alarm",
    ringing: "Ringing",
    waiting: "Waiting",
    noAlarms: "No alarms",
    editAlarm: "Edit alarm",
    newAlarm: "New alarm",
    title: "Title",
    countdown: "Countdown",
    dateTime: "Date and time",
    date: "Date",
    time: "Time",
    minutesShort: "Min",
    secondsShort: "Sec",
    sound: "Sound",
    silent: "Silent",
    repeat: "Repeat",
    noRepeat: "Does not repeat",
    repeatDaily: "Every day",
    repeatWorkdays: "Weekdays",
    repeatWeekly: "Weekly",
    repeatMonthly: "Monthly",
    repeatYearly: "Yearly",
    repeatDays: "Days",
    ends: "Ends",
    never: "Never",
    endsOnDate: "On date",
    endsAfter: "After occurrences",
    occurrences: "Times",
    noEndDate: "without end date",
    until: "until",
    notes: "Notes",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    activeAlarms: "Active alarms",
    noActiveAlarms: "No active alarms.",
    untitled: "Untitled",
    muted: "Muted",
    edit: "Edit",
    ringingSection: "Ringing",
    nothingActive: "Nothing active.",
    dismiss: "Dismiss",
    about: "About",
    settings: "Settings",
    close: "Close",
    aboutTitle: "About Puntual",
    aboutText: "Desktop alarm app with tray integration, real persistence and a countdown that survives closes and restarts.",
    version: "Version",
    license: "License",
    repository: "Repository",
    openRepo: "Open repo",
    downloads: "Downloads",
    checkUpdates: "Check for updates",
    checkingUpdates: "Checking the latest published release...",
    checkUpdatesFailed: "Could not check for updates.",
    invalidReleaseData: "GitHub did not return a valid version.",
    upToDate: "You're up to date. Latest published version: {version}.",
    updateAvailable: "A newer version is available: {version}.",
    openRelease: "Open release",
    settingsTitle: "Settings",
    appLanguage: "App language",
    systemLanguage: "Detected system language: {language}.",
    launchAtLogin: "Start Puntual with the system",
    launchAtLoginHelp: "Open the app when the session starts and keep it minimized to the tray.",
    invalidCountdown: "Invalid countdown.",
    invalidDate: "Invalid date.",
    invalidRepeatDays: "Select at least one day.",
    invalidEndDate: "Invalid end date.",
    invalidRepeatCount: "Invalid number of occurrences.",
    saveFailed: "Could not save.",
  },
} as const;

type MessageCatalog = (typeof MESSAGES)[keyof typeof MESSAGES];

function toInputDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toInputTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(11, 16);
}

function parseAbsoluteTarget(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return Number.NaN;
  }
  return new Date(`${dateValue}T${timeValue}`).getTime();
}

function toEndOfDayTimestamp(dateValue: string) {
  if (!dateValue) {
    return null;
  }
  const parsed = new Date(`${dateValue}T23:59:59.999`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getWeekdayNumber(timestamp: number) {
  const day = new Date(timestamp).getDay();
  return day === 0 ? 7 : day;
}

function createDefaultComposer() {
  const now = new Date();
  return {
    title: "",
    notes: "",
    targetDate: toInputDate(now),
    targetTime: toInputTime(now),
    countdownMinutes: "5",
    countdownSeconds: "0",
    soundEnabled: true,
    repeatKind: "none" as AlarmRepeatKind,
    repeatWeekDays: [] as number[],
    repeatEndType: "never" as AlarmRepeatEndType,
    repeatEndDate: "",
    repeatCount: "10",
  };
}

function compareVersions(left: string, right: string) {
  const normalize = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = normalize(left);
  const b = normalize(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function normalizeLocale(value: string | undefined | null): Exclude<AppLocale, "system"> {
  const base = String(value ?? "").toLowerCase().split("-")[0];
  return base === "ca" || base === "en" ? base : "es";
}

function translate(locale: Exclude<AppLocale, "system">, key: keyof (typeof MESSAGES)["es"], variables: Record<string, string | number> = {}) {
  const template = MESSAGES[locale][key] ?? MESSAGES.es[key];
  return template.replace(/\{(\w+)\}/g, (_match, token) => String(variables[token] ?? ""));
}

function formatTargetDate(
  timestamp: number,
  locale: Exclude<AppLocale, "system">,
  messages: MessageCatalog
) {
  const date = new Date(timestamp);
  const dateFnsLocale = DATE_FNS_LOCALES[locale];

  if (isToday(date)) {
    return `${messages.today} ${format(date, "HH:mm", { locale: dateFnsLocale })}`;
  }

  if (isTomorrow(date)) {
    return `${messages.tomorrow} ${format(date, "HH:mm", { locale: dateFnsLocale })}`;
  }

  return format(date, "d MMM, HH:mm", { locale: dateFnsLocale });
}

function formatRemaining(
  timestamp: number,
  referenceNow: number,
  locale: Exclude<AppLocale, "system">,
  messages: MessageCatalog
) {
  const diff = timestamp - referenceNow;

  if (diff <= 0) {
    return messages.now;
  }

  return formatDistanceStrict(timestamp, referenceNow, {
    locale: DATE_FNS_LOCALES[locale],
    addSuffix: true,
  });
}

type ComposerState = {
  title: string;
  notes: string;
  targetDate: string;
  targetTime: string;
  countdownMinutes: string;
  countdownSeconds: string;
  soundEnabled: boolean;
  repeatKind: AlarmRepeatKind;
  repeatWeekDays: number[];
  repeatEndType: AlarmRepeatEndType;
  repeatEndDate: string;
  repeatCount: string;
};

function formatRepeatLabel(kind: AlarmRepeatKind, messages: MessageCatalog) {
  switch (kind) {
    case "daily":
      return messages.repeatDaily;
    case "workdays":
      return messages.repeatWorkdays;
    case "weekly":
      return messages.repeatWeekly;
    case "monthly":
      return messages.repeatMonthly;
    case "yearly":
      return messages.repeatYearly;
    default:
      return messages.noRepeat;
  }
}

function formatWeekDayList(weekDays: number[], locale: Exclude<AppLocale, "system">) {
  return WEEKDAY_OPTIONS.filter((option) => weekDays.includes(option.value))
    .map((option) => option[locale])
    .join(", ");
}

function formatRepeatSummary(repeat: AlarmRepeat, locale: Exclude<AppLocale, "system">, messages: MessageCatalog) {
  if (repeat.kind === "none") {
    return messages.noRepeat;
  }

  const base =
    repeat.kind === "weekly" && repeat.weekDays.length > 0
      ? `${messages.repeatWeekly}: ${formatWeekDayList(repeat.weekDays, locale)}`
      : formatRepeatLabel(repeat.kind, messages);

  if (repeat.endType === "onDate" && repeat.endAt) {
    return `${base} ${messages.until} ${format(new Date(repeat.endAt), "d MMM yyyy", { locale: DATE_FNS_LOCALES[locale] })}`;
  }
  if (repeat.endType === "afterCount" && repeat.maxOccurrences) {
    return `${base}, ${repeat.maxOccurrences} ${messages.occurrences.toLowerCase()}`;
  }

  return `${base} ${messages.noEndDate}`;
}

function buildRepeatInput(
  composer: ComposerState,
  targetAt: number
): AlarmRepeatInput | null {
  if (composer.repeatKind === "none") {
    return {
      kind: "none",
      weekDays: [],
      endType: "never",
      endAt: null,
      maxOccurrences: null,
    };
  }

  const weekDays =
    composer.repeatKind === "weekly"
      ? Array.from(new Set(composer.repeatWeekDays)).sort((left, right) => left - right)
      : [];

  if (composer.repeatKind === "weekly" && weekDays.length === 0) {
    return null;
  }

  if (composer.repeatEndType === "onDate") {
    const endAt = toEndOfDayTimestamp(composer.repeatEndDate);
    if (endAt === null || endAt < targetAt) {
      return null;
    }
    return {
      kind: composer.repeatKind,
      weekDays,
      endType: "onDate",
      endAt,
      maxOccurrences: null,
    };
  }

  if (composer.repeatEndType === "afterCount") {
    const maxOccurrences = Number.parseInt(composer.repeatCount, 10);
    if (!Number.isInteger(maxOccurrences) || maxOccurrences < 1) {
      return null;
    }
    return {
      kind: composer.repeatKind,
      weekDays,
      endType: "afterCount",
      endAt: null,
      maxOccurrences,
    };
  }

  return {
    kind: composer.repeatKind,
    weekDays,
    endType: "never",
    endAt: null,
    maxOccurrences: null,
  };
}

function App() {
  const [state, setState] = useState<AlarmState>(fallbackState);
  const [composer, setComposer] = useState<ComposerState>(createDefaultComposer);
  const [scheduleMode, setScheduleMode] = useState<"absolute" | "countdown">("countdown");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [ringing, setRinging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const systemLocale = useMemo(() => normalizeLocale(typeof navigator === "undefined" ? "es" : navigator.language), []);
  const appLocale = state.settings.locale === "system" ? systemLocale : state.settings.locale;
  const messages = MESSAGES[appLocale];
  const languageName = LOCALE_LABELS[appLocale][appLocale];

  useEffect(() => {
    let mounted = true;

    window.alarmApi.getState().then((nextState) => {
      if (!mounted) {
        return;
      }
      setState(nextState);
      setRinging(nextState.alarms.some((alarm) => alarm.status === "ringing" && alarm.soundEnabled));
    });

    const unsubscribeState = window.alarmApi.onState((nextState) => {
      setState(nextState);
      setRinging(nextState.alarms.some((alarm) => alarm.status === "ringing" && alarm.soundEnabled));
    });
    const unsubscribeRing = window.alarmApi.onRingState((nextRinging) => setRinging(nextRinging));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeRing();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current ?? new Audio(ALARM_SOUND_PATH);
    audioRef.current = audio;
    audio.loop = true;

    if (!ringing) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    void audio.play().catch(() => undefined);
  }, [ringing]);

  const scheduled = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "scheduled").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const ringingAlarms = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "ringing").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const nextAlarm = scheduled[0] ?? null;
  const countdownDurationMs = useMemo(() => {
    const minutes = Number(composer.countdownMinutes || 0);
    const seconds = Number(composer.countdownSeconds || 0);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }
    const totalMs = Math.max(0, minutes) * 60_000 + Math.max(0, seconds) * 1_000;
    return totalMs > 0 ? totalMs : null;
  }, [composer.countdownMinutes, composer.countdownSeconds]);
  const previewTargetAt = useMemo(() => {
    if (scheduleMode === "countdown") {
      return countdownDurationMs ? now + countdownDurationMs : null;
    }
    const parsed = parseAbsoluteTarget(composer.targetDate, composer.targetTime);
    return Number.isFinite(parsed) && parsed > now ? parsed : null;
  }, [composer.targetDate, composer.targetTime, countdownDurationMs, now, scheduleMode]);
  const headerTargetAt = nextAlarm?.targetAt ?? previewTargetAt;
  const headerTargetLabel = nextAlarm
    ? formatTargetDate(nextAlarm.targetAt, appLocale, messages)
    : previewTargetAt
      ? translate(appLocale, "preview", { value: formatTargetDate(previewTargetAt, appLocale, messages) })
      : messages.noNextAlarm;

  function resetComposer() {
    setComposer(createDefaultComposer());
    setScheduleMode("countdown");
    setEditingId(null);
    setError("");
  }

  function startEditing(alarm: Alarm) {
    setEditingId(alarm.id);
    setError("");
    setComposer({
      title: alarm.title,
      notes: alarm.notes,
      targetDate: toInputDate(new Date(alarm.targetAt)),
      targetTime: toInputTime(new Date(alarm.targetAt)),
      countdownMinutes: "5",
      countdownSeconds: "0",
      soundEnabled: alarm.soundEnabled,
      repeatKind: alarm.repeat.kind,
      repeatWeekDays: [...alarm.repeat.weekDays],
      repeatEndType: alarm.repeat.kind === "none" ? "never" : alarm.repeat.endType,
      repeatEndDate: alarm.repeat.endAt ? toInputDate(new Date(alarm.repeat.endAt)) : "",
      repeatCount: String(alarm.repeat.maxOccurrences ?? 10),
    });
    setScheduleMode("absolute");
  }

  async function submitAlarm(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const targetAt =
      scheduleMode === "countdown"
        ? Date.now() + (countdownDurationMs ?? NaN)
        : parseAbsoluteTarget(composer.targetDate, composer.targetTime);
    if (!Number.isFinite(targetAt)) {
      setError(scheduleMode === "countdown" ? messages.invalidCountdown : messages.invalidDate);
      return;
    }

    let repeat: AlarmRepeatInput;
    if (scheduleMode === "countdown") {
      repeat = {
        kind: "none",
        weekDays: [],
        endType: "never",
        endAt: null,
        maxOccurrences: null,
      };
    } else {
      const nextRepeat = buildRepeatInput(composer, targetAt);
      if (!nextRepeat) {
        if (composer.repeatKind === "weekly" && composer.repeatWeekDays.length === 0) {
          setError(messages.invalidRepeatDays);
        } else if (composer.repeatEndType === "onDate") {
          setError(messages.invalidEndDate);
        } else {
          setError(messages.invalidRepeatCount);
        }
        return;
      }
      repeat = nextRepeat;
    }

    const payload = {
      title: composer.title.trim(),
      notes: composer.notes.trim(),
      targetAt,
      soundEnabled: composer.soundEnabled,
      repeat,
    };

    try {
      if (editingId) {
        await window.alarmApi.updateAlarm({ ...payload, id: editingId });
      } else {
        await window.alarmApi.createAlarm(payload);
      }
      resetComposer();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : messages.saveFailed);
    }
  }

  async function dismissAlarm(id: string) {
    await window.alarmApi.dismissAlarm(id);
  }

  async function deleteAlarm(id: string) {
    await window.alarmApi.deleteAlarm(id);
    if (editingId === id) {
      resetComposer();
    }
  }

  async function openExternal(url: string) {
    await window.alarmApi.openExternal(url);
  }

  async function setLocale(locale: AppLocale) {
    await window.alarmApi.setLocale(locale);
  }

  async function checkForUpdates() {
    setUpdateStatus({ kind: "checking" });

    try {
      const response = await fetch(LATEST_RELEASE_API, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        throw new Error(messages.checkUpdatesFailed);
      }

      const release = (await response.json()) as { tag_name?: string; html_url?: string };
      const latestVersion = String(release.tag_name ?? "").replace(/^v/i, "");

      if (!latestVersion) {
        throw new Error(messages.invalidReleaseData);
      }

      if (compareVersions(latestVersion, APP_VERSION) > 0) {
        setUpdateStatus({
          kind: "available",
          version: latestVersion,
          url: String(release.html_url ?? APP_REPOSITORY),
        });
        return;
      }

      setUpdateStatus({ kind: "up-to-date", version: latestVersion });
    } catch (caughtError) {
      setUpdateStatus({
        kind: "error",
        message: caughtError instanceof Error ? caughtError.message : messages.checkUpdatesFailed,
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clock3 size={13} />
          </div>
          <div className="brand-copy">
            <strong>Puntual</strong>
            <span>{now ? format(new Date(now), "EEEE d MMMM, HH:mm", { locale: DATE_FNS_LOCALES[appLocale] }) : ""}</span>
          </div>
        </div>

        <div className="topbar-center">
          <div className="status-line">
            <span className={`state-chip ${ringing ? "alert" : ""}`}>{ringing ? messages.ringing : messages.waiting}</span>
            <strong>{headerTargetAt ? formatRemaining(headerTargetAt, now, appLocale, messages) : messages.noAlarms}</strong>
          </div>
          <span className="next-line">{headerTargetLabel}</span>
        </div>

        <button
          type="button"
          className="icon-button topbar-action"
          onClick={() => setSettingsOpen(true)}
          aria-label={messages.settings}
          title={messages.settings}
        >
          <Settings size={13} />
        </button>

        <button type="button" className="secondary-button topbar-action" onClick={() => setAboutOpen(true)}>
          <Info size={13} />
          {messages.about}
        </button>
      </header>

      <section className="main-grid">
        <form className="composer" onSubmit={submitAlarm}>
          <div className="section-head">
            <h1>{editingId ? messages.editAlarm : messages.newAlarm}</h1>
          </div>

          <input
            value={composer.title}
            onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
            placeholder={messages.title}
          />

          <div className="mode-row">
            <button
              type="button"
              className={scheduleMode === "countdown" ? "toggle-button active" : "toggle-button"}
              onClick={() => {
                setScheduleMode("countdown");
                setComposer((current) => ({
                  ...current,
                  repeatKind: "none",
                  repeatWeekDays: [],
                  repeatEndType: "never",
                  repeatEndDate: "",
                }));
              }}
            >
              {messages.countdown}
            </button>
            <button
              type="button"
              className={scheduleMode === "absolute" ? "toggle-button active" : "toggle-button"}
              onClick={() => setScheduleMode("absolute")}
            >
              {messages.dateTime}
            </button>
          </div>

          {scheduleMode === "countdown" ? (
            <div className="countdown-row">
              <input
                type="number"
                min="0"
                value={composer.countdownMinutes}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, countdownMinutes: event.target.value }))
                }
                placeholder={messages.minutesShort}
              />
              <input
                type="number"
                min="0"
                max="59"
                value={composer.countdownSeconds}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, countdownSeconds: event.target.value }))
                }
                placeholder={messages.secondsShort}
              />
            </div>
          ) : (
            <>
              <div className="field-grid">
                <label className="field-block">
                  <span>{messages.date}</span>
                  <input
                    type="date"
                    value={composer.targetDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setComposer((current) => ({
                        ...current,
                        targetDate: nextDate,
                        repeatWeekDays:
                          current.repeatKind === "weekly" && current.repeatWeekDays.length === 0 && nextDate && current.targetTime
                            ? [getWeekdayNumber(parseAbsoluteTarget(nextDate, current.targetTime))]
                            : current.repeatWeekDays,
                      }));
                    }}
                  />
                </label>
                <label className="field-block">
                  <span>{messages.time}</span>
                  <input
                    type="time"
                    value={composer.targetTime}
                    onChange={(event) => setComposer((current) => ({ ...current, targetTime: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field-block">
                <span>{messages.repeat}</span>
                <select
                  className="settings-select"
                  value={composer.repeatKind}
                  onChange={(event) => {
                    const nextKind = event.target.value as AlarmRepeatKind;
                    const nextTargetAt = parseAbsoluteTarget(composer.targetDate, composer.targetTime);
                    setComposer((current) => ({
                      ...current,
                      repeatKind: nextKind,
                      repeatWeekDays:
                        nextKind === "weekly"
                          ? current.repeatWeekDays.length > 0
                            ? current.repeatWeekDays
                            : Number.isFinite(nextTargetAt)
                              ? [getWeekdayNumber(nextTargetAt)]
                              : []
                          : [],
                      repeatEndType: nextKind === "none" ? "never" : current.repeatEndType,
                    }));
                  }}
                >
                  <option value="none">{messages.noRepeat}</option>
                  <option value="daily">{messages.repeatDaily}</option>
                  <option value="workdays">{messages.repeatWorkdays}</option>
                  <option value="weekly">{messages.repeatWeekly}</option>
                  <option value="monthly">{messages.repeatMonthly}</option>
                  <option value="yearly">{messages.repeatYearly}</option>
                </select>
              </label>

              {composer.repeatKind === "weekly" ? (
                <div className="field-block">
                  <span>{messages.repeatDays}</span>
                  <div className="weekday-row">
                    {WEEKDAY_OPTIONS.map((option) => {
                      const active = composer.repeatWeekDays.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={active ? "weekday-button active" : "weekday-button"}
                          onClick={() =>
                            setComposer((current) => ({
                              ...current,
                              repeatWeekDays: active
                                ? current.repeatWeekDays.filter((day) => day !== option.value)
                                : [...current.repeatWeekDays, option.value].sort((left, right) => left - right),
                            }))
                          }
                        >
                          {option[appLocale]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {composer.repeatKind !== "none" ? (
                <>
                  <label className="field-block">
                    <span>{messages.ends}</span>
                    <select
                      className="settings-select"
                      value={composer.repeatEndType}
                      onChange={(event) =>
                        setComposer((current) => ({
                          ...current,
                          repeatEndType: event.target.value as AlarmRepeatEndType,
                        }))
                      }
                    >
                      <option value="never">{messages.never}</option>
                      <option value="onDate">{messages.endsOnDate}</option>
                      <option value="afterCount">{messages.endsAfter}</option>
                    </select>
                  </label>

                  {composer.repeatEndType === "onDate" ? (
                    <label className="field-block">
                      <span>{messages.endsOnDate}</span>
                      <input
                        type="date"
                        value={composer.repeatEndDate}
                        onChange={(event) => setComposer((current) => ({ ...current, repeatEndDate: event.target.value }))}
                      />
                    </label>
                  ) : null}

                  {composer.repeatEndType === "afterCount" ? (
                    <label className="field-block">
                      <span>{messages.occurrences}</span>
                      <input
                        type="number"
                        min="1"
                        value={composer.repeatCount}
                        onChange={(event) => setComposer((current) => ({ ...current, repeatCount: event.target.value }))}
                      />
                    </label>
                  ) : null}

                  <div className="repeat-summary">
                    {formatRepeatSummary(
                      {
                        kind: composer.repeatKind,
                        weekDays: composer.repeatWeekDays,
                        endType: composer.repeatEndType,
                        endAt: composer.repeatEndType === "onDate" ? toEndOfDayTimestamp(composer.repeatEndDate) : null,
                        maxOccurrences:
                          composer.repeatEndType === "afterCount" ? Number.parseInt(composer.repeatCount, 10) || null : null,
                        occurrenceCount: 1,
                        anchorAt: previewTargetAt ?? now,
                      },
                      appLocale,
                      messages
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}

          <div className="composer-row">
            <button
              type="button"
              className={composer.soundEnabled ? "toggle-button active" : "toggle-button"}
              onClick={() => setComposer((current) => ({ ...current, soundEnabled: !current.soundEnabled }))}
            >
              {composer.soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {composer.soundEnabled ? messages.sound : messages.silent}
            </button>
          </div>

          <textarea
            value={composer.notes}
            onChange={(event) => setComposer((current) => ({ ...current, notes: event.target.value }))}
            placeholder={messages.notes}
            rows={2}
          />

          {error ? <div className="error-banner">{error}</div> : null}

          {editingId ? (
            <button type="button" className="secondary-button full-width" onClick={resetComposer}>
              {messages.cancel}
            </button>
          ) : null}

          <button type="submit" className="primary-button primary-submit">
            <Plus size={13} />
            {editingId ? messages.save : messages.add}
          </button>
        </form>

        <section className="lists">
          <div className="list-block">
            <div className="list-head">
              <h2>{messages.activeAlarms}</h2>
              <span>{scheduled.length}</span>
            </div>

            <div className="list-body">
              {scheduled.length === 0 ? (
                <div className="empty-state">{messages.noActiveAlarms}</div>
              ) : (
                scheduled.map((alarm) => (
                  <article className="alarm-row" key={alarm.id}>
                    <div className="alarm-copy">
                      <strong title={alarm.notes || undefined}>{alarm.title || messages.untitled}</strong>
                      <span>{formatTargetDate(alarm.targetAt, appLocale, messages)}</span>
                      {alarm.repeat.kind !== "none" ? (
                        <small>{formatRepeatSummary(alarm.repeat, appLocale, messages)}</small>
                      ) : null}
                      <small>{now ? formatRemaining(alarm.targetAt, now, appLocale, messages) : ""}</small>
                    </div>

                    <div className="alarm-actions">
                      <span className={alarm.soundEnabled ? "sound-pill active" : "sound-pill"}>
                        {alarm.soundEnabled ? messages.sound : messages.muted}
                      </span>
                      <button type="button" className="secondary-button" onClick={() => startEditing(alarm)}>
                        {messages.edit}
                      </button>
                      <button type="button" className="icon-button" onClick={() => deleteAlarm(alarm.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="list-block">
            <div className="list-head">
              <h2>{messages.ringingSection}</h2>
              <span>{ringingAlarms.length}</span>
            </div>

            <div className="list-body small">
              {ringingAlarms.length === 0 ? (
                <div className="empty-state">{messages.nothingActive}</div>
              ) : (
                ringingAlarms.map((alarm) => (
                  <article className="alarm-row alert" key={alarm.id}>
                    <div className="alarm-copy">
                      <strong>{alarm.title || messages.untitled}</strong>
                      <span>{formatTargetDate(alarm.targetAt, appLocale, messages)}</span>
                    </div>

                    <button type="button" className="primary-button" onClick={() => dismissAlarm(alarm.id)}>
                      {messages.dismiss}
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      {settingsOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <section
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h2 id="settings-title">{messages.settingsTitle}</h2>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} aria-label={messages.close}>
                ×
              </button>
            </div>

            <div className="settings-block">
              <label className="settings-label" htmlFor="app-locale">
                {messages.appLanguage}
              </label>
              <select
                id="app-locale"
                className="settings-select"
                value={state.settings.locale}
                onChange={(event) => setLocale(event.target.value as AppLocale)}
              >
                {(["system", "es", "ca", "en"] as AppLocale[]).map((locale) => (
                  <option key={locale} value={locale}>
                    {LOCALE_LABELS[locale][appLocale]}
                  </option>
                ))}
              </select>
              <span className="settings-help">{translate(appLocale, "systemLanguage", { language: languageName })}</span>
            </div>

            <div className="settings-block">
              <label className="checkbox-inline prominent">
                <input
                  type="checkbox"
                  checked={state.settings.launchAtLogin}
                  onChange={(event) => window.alarmApi.setLaunchAtLogin(event.target.checked)}
                />
                <span>{messages.launchAtLogin}</span>
              </label>
              <span className="settings-help">{messages.launchAtLoginHelp}</span>
            </div>
          </section>
        </div>
      ) : null}

      {aboutOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <section
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h2 id="about-title">{messages.aboutTitle}</h2>
              <button type="button" className="icon-button" onClick={() => setAboutOpen(false)} aria-label={messages.close}>
                ×
              </button>
            </div>

            <p className="about-copy">{messages.aboutText}</p>

            <dl className="about-meta">
              <div>
                <dt>{messages.version}</dt>
                <dd>{APP_VERSION}</dd>
              </div>
              <div>
                <dt>{messages.license}</dt>
                <dd>{APP_LICENSE}</dd>
              </div>
              <div>
                <dt>{messages.repository}</dt>
                <dd>{APP_REPOSITORY.replace(/^https?:\/\//, "")}</dd>
              </div>
            </dl>

            <div className="about-actions">
              <button type="button" className="secondary-button" onClick={() => openExternal(APP_REPOSITORY)}>
                <ExternalLink size={13} />
                {messages.openRepo}
              </button>
              <button type="button" className="secondary-button" onClick={() => openExternal(`${APP_REPOSITORY}/releases/latest`)}>
                <ExternalLink size={13} />
                {messages.downloads}
              </button>
              <button type="button" className="secondary-button" onClick={checkForUpdates}>
                <RefreshCw size={13} className={updateStatus.kind === "checking" ? "spin" : ""} />
                {messages.checkUpdates}
              </button>
            </div>

            <div className="update-status" aria-live="polite">
              {updateStatus.kind === "checking" ? <span>{messages.checkingUpdates}</span> : null}
              {updateStatus.kind === "up-to-date" ? (
                <span>{translate(appLocale, "upToDate", { version: updateStatus.version })}</span>
              ) : null}
              {updateStatus.kind === "available" ? (
                <span>
                  {translate(appLocale, "updateAvailable", { version: updateStatus.version })}{" "}
                  <button type="button" className="inline-link" onClick={() => openExternal(updateStatus.url)}>
                    {messages.openRelease}
                  </button>
                </span>
              ) : null}
              {updateStatus.kind === "error" ? <span>{updateStatus.message}</span> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
