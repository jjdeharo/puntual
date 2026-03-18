import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { ca, enUS, es, eu, gl } from "date-fns/locale";
import { Bell, BellOff, CalendarClock, Clock3, ExternalLink, FolderOpen, Info, Plus, RefreshCw, Settings, Trash2, X } from "lucide-react";
import "./App.css";
import type {
  Alarm,
  AlarmMonthlyMode,
  AlarmMonthlyWeek,
  AlarmRepeat,
  AlarmRepeatEndType,
  AlarmRepeatInput,
  AlarmRepeatKind,
  AlarmState,
  AppLocale,
} from "./types";

const ALARM_SOUND_PATH = new URL("./assets/alarm-clock-elapsed.oga", import.meta.url).href;

const fallbackState: AlarmState = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
    locale: "system",
    lastSoundSource: null,
  },
};

const APP_VERSION = __APP_VERSION__;
const APP_LICENSE = __APP_LICENSE__;
const APP_REPOSITORY = __APP_REPOSITORY__;
const LATEST_RELEASE_API = "https://api.github.com/repos/jjdeharo/puntual/releases/latest";
const AUTO_UPDATE_CHECK_KEY = "puntual:last-update-check-at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  ga: gl,
  eu,
} as const;

const LOCALE_LABELS: Record<AppLocale, Record<Exclude<AppLocale, "system">, string>> = {
  system: { es: "Automático", ca: "Automàtic", en: "Automatic", ga: "Automático", eu: "Automatikoa" },
  es: { es: "Español", ca: "Espanyol", en: "Spanish", ga: "Gaztelania", eu: "Gaztelania" },
  ca: { es: "Catalán", ca: "Català", en: "Catalan", ga: "Catalán", eu: "Katalana" },
  en: { es: "Inglés", ca: "Anglès", en: "English", ga: "Inglés", eu: "Ingelesa" },
  ga: { es: "Gallego", ca: "Gallec", en: "Galician", ga: "Galego", eu: "Galiziera" },
  eu: { es: "Euskera", ca: "Euskera", en: "Basque", ga: "Éuscaro", eu: "Euskara" },
};

const WEEKDAY_OPTIONS: ReadonlyArray<{
  value: number;
  short: Record<Exclude<AppLocale, "system">, string>;
  long: Record<Exclude<AppLocale, "system">, string>;
}> = [
  { value: 1, short: { es: "L", ca: "Dl", en: "Mo", ga: "L", eu: "Al" }, long: { es: "lunes", ca: "dilluns", en: "Monday", ga: "luns", eu: "astelehena" } },
  { value: 2, short: { es: "M", ca: "Dt", en: "Tu", ga: "M", eu: "Ar" }, long: { es: "martes", ca: "dimarts", en: "Tuesday", ga: "martes", eu: "asteartea" } },
  { value: 3, short: { es: "X", ca: "Dc", en: "We", ga: "X", eu: "Az" }, long: { es: "miércoles", ca: "dimecres", en: "Wednesday", ga: "mércores", eu: "asteazkena" } },
  { value: 4, short: { es: "J", ca: "Dj", en: "Th", ga: "X", eu: "Og" }, long: { es: "jueves", ca: "dijous", en: "Thursday", ga: "xoves", eu: "osteguna" } },
  { value: 5, short: { es: "V", ca: "Dv", en: "Fr", ga: "V", eu: "Or" }, long: { es: "viernes", ca: "divendres", en: "Friday", ga: "venres", eu: "ostirala" } },
  { value: 6, short: { es: "S", ca: "Ds", en: "Sa", ga: "S", eu: "Lr" }, long: { es: "sábado", ca: "dissabte", en: "Saturday", ga: "sábado", eu: "larunbata" } },
  { value: 7, short: { es: "D", ca: "Dg", en: "Su", ga: "D", eu: "Ig" }, long: { es: "domingo", ca: "diumenge", en: "Sunday", ga: "domingo", eu: "igandea" } },
] as const;

const MONTHLY_WEEK_OPTIONS: Array<{ value: AlarmMonthlyWeek; labels: Record<Exclude<AppLocale, "system">, string> }> = [
  { value: 1, labels: { es: "primer", ca: "primer", en: "first", ga: "primeiro", eu: "lehen" } },
  { value: 2, labels: { es: "segundo", ca: "segon", en: "second", ga: "segundo", eu: "bigarren" } },
  { value: 3, labels: { es: "tercer", ca: "tercer", en: "third", ga: "terceiro", eu: "hirugarren" } },
  { value: 4, labels: { es: "cuarto", ca: "quart", en: "fourth", ga: "cuarto", eu: "laugarren" } },
  { value: -1, labels: { es: "último", ca: "últim", en: "last", ga: "último", eu: "azken" } },
];

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
    alarm: "Alarma",
    countdown: "Temporizador",
    dateTime: "Fecha y hora",
    date: "Fecha",
    time: "Hora",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "Sonido",
    customSound: "Sonido personalizado",
    chooseSound: "Elegir archivo",
    clearSound: "Quitar sonido",
    defaultSound: "Sonido por defecto",
    silent: "Silencio",
    repeat: "Repetir",
    noRepeat: "No repetir",
    repeatDaily: "Cada día",
    repeatWorkdays: "Días laborables",
    repeatWeekly: "Semanalmente",
    repeatMonthly: "Mensualmente",
    repeatYearly: "Anualmente",
    repeatDays: "Días",
    monthlyPattern: "Patrón mensual",
    monthlyByDayOfMonth: "Mismo día del mes",
    monthlyByWeekdayOfMonth: "Día de la semana",
    monthlyWeek: "Semana",
    monthlyWeekDay: "Día de la semana",
    ends: "Finaliza",
    never: "Nunca",
    endsOnDate: "En fecha",
    endsAfter: "Tras repeticiones",
    occurrences: "Veces",
    noEndDate: "sin fecha de fin",
    until: "hasta",
    dayOfMonthPrefix: "día",
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
    alarm: "Alarma",
    countdown: "Temporitzador",
    dateTime: "Data i hora",
    date: "Data",
    time: "Hora",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "So",
    customSound: "So personalitzat",
    chooseSound: "Tria fitxer",
    clearSound: "Treu so",
    defaultSound: "So per defecte",
    silent: "Silenci",
    repeat: "Repeteix",
    noRepeat: "No es repeteix",
    repeatDaily: "Cada dia",
    repeatWorkdays: "Dies feiners",
    repeatWeekly: "Setmanalment",
    repeatMonthly: "Mensualment",
    repeatYearly: "Anualment",
    repeatDays: "Dies",
    monthlyPattern: "Patró mensual",
    monthlyByDayOfMonth: "Mateix dia del mes",
    monthlyByWeekdayOfMonth: "Dia de la setmana",
    monthlyWeek: "Setmana",
    monthlyWeekDay: "Dia de la setmana",
    ends: "Finalitza",
    never: "Mai",
    endsOnDate: "En data",
    endsAfter: "Després de repeticions",
    occurrences: "Vegades",
    noEndDate: "sense data de fi",
    until: "fins al",
    dayOfMonthPrefix: "dia",
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
  ga: {
    now: "Agora",
    today: "Hoxe",
    tomorrow: "Mañá",
    preview: "Vista previa: {value}",
    noNextAlarm: "Sen próxima alarma",
    ringing: "Soando",
    waiting: "En espera",
    noAlarms: "Sen alarmas",
    editAlarm: "Editar alarma",
    newAlarm: "Nova alarma",
    title: "Título",
    alarm: "Alarma",
    countdown: "Temporizador",
    dateTime: "Data e hora",
    date: "Data",
    time: "Hora",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "Son",
    customSound: "Son personalizado",
    chooseSound: "Escoller ficheiro",
    clearSound: "Quitar son",
    defaultSound: "Son predeterminado",
    silent: "Silencio",
    repeat: "Repetir",
    noRepeat: "Non repetir",
    repeatDaily: "Cada día",
    repeatWorkdays: "Días laborables",
    repeatWeekly: "Semanalmente",
    repeatMonthly: "Mensualmente",
    repeatYearly: "Anualmente",
    repeatDays: "Días",
    monthlyPattern: "Patrón mensual",
    monthlyByDayOfMonth: "Mesmo día do mes",
    monthlyByWeekdayOfMonth: "Día da semana",
    monthlyWeek: "Semana",
    monthlyWeekDay: "Día da semana",
    ends: "Finaliza",
    never: "Nunca",
    endsOnDate: "En data",
    endsAfter: "Tras repeticións",
    occurrences: "Veces",
    noEndDate: "sen data de fin",
    until: "ata",
    dayOfMonthPrefix: "día",
    notes: "Notas",
    cancel: "Cancelar",
    save: "Gardar",
    add: "Engadir",
    activeAlarms: "Alarmas activas",
    noActiveAlarms: "Sen alarmas activas.",
    untitled: "Sen título",
    muted: "Muda",
    edit: "Editar",
    ringingSection: "Soando",
    nothingActive: "Nada activo.",
    dismiss: "Descartar",
    about: "Acerca de",
    settings: "Configuración",
    close: "Pechar",
    aboutTitle: "Acerca de Puntual",
    aboutText: "Alarma de escritorio con bandexa, persistencia real e un temporizador que sobrevive a peches e reinicios.",
    version: "Versión",
    license: "Licenza",
    repository: "Repositorio",
    openRepo: "Abrir repo",
    downloads: "Descargas",
    checkUpdates: "Buscar actualizacións",
    checkingUpdates: "Consultando a última release publicada...",
    checkUpdatesFailed: "Non se puido comprobar se hai actualizacións.",
    invalidReleaseData: "GitHub non devolveu unha versión válida.",
    upToDate: "Estás ao día. Última versión publicada: {version}.",
    updateAvailable: "Hai unha versión máis recente: {version}.",
    openRelease: "Abrir release",
    settingsTitle: "Configuración",
    appLanguage: "Idioma da app",
    systemLanguage: "Idioma detectado do sistema: {language}.",
    launchAtLogin: "Iniciar Puntual co sistema",
    launchAtLoginHelp: "Abre a aplicación ao iniciar sesión e déixaa minimizada na bandexa.",
    invalidCountdown: "Temporizador inválido.",
    invalidDate: "Data inválida.",
    invalidRepeatDays: "Selecciona polo menos un día.",
    invalidEndDate: "Data de fin inválida.",
    invalidRepeatCount: "Número de repeticións inválido.",
    saveFailed: "Non se puido gardar.",
  },
  eu: {
    now: "Orain",
    today: "Gaur",
    tomorrow: "Bihar",
    preview: "Aurrebista: {value}",
    noNextAlarm: "Hurrengo alarmarik ez",
    ringing: "Jotzen",
    waiting: "Zain",
    noAlarms: "Alarmarik ez",
    editAlarm: "Editatu alarma",
    newAlarm: "Alarma berria",
    title: "Izenburua",
    alarm: "Alarma",
    countdown: "Tenporizadorea",
    dateTime: "Data eta ordua",
    date: "Data",
    time: "Ordua",
    minutesShort: "Min",
    secondsShort: "Seg",
    sound: "Soinua",
    customSound: "Soinu pertsonalizatua",
    chooseSound: "Aukeratu fitxategia",
    clearSound: "Kendu soinua",
    defaultSound: "Lehenetsitako soinua",
    silent: "Isilik",
    repeat: "Errepikatu",
    noRepeat: "Ez errepikatu",
    repeatDaily: "Egunero",
    repeatWorkdays: "Lanegunetan",
    repeatWeekly: "Astero",
    repeatMonthly: "Hilero",
    repeatYearly: "Urtero",
    repeatDays: "Egunak",
    monthlyPattern: "Hileko eredua",
    monthlyByDayOfMonth: "Hileko egun bera",
    monthlyByWeekdayOfMonth: "Asteko eguna",
    monthlyWeek: "Astea",
    monthlyWeekDay: "Asteko eguna",
    ends: "Amaitzen da",
    never: "Inoiz ez",
    endsOnDate: "Data jakin batean",
    endsAfter: "Errepikapen kopuruaren ondoren",
    occurrences: "Aldiz",
    noEndDate: "amaiera-datarik gabe",
    until: "arte",
    dayOfMonthPrefix: "eguna",
    notes: "Oharrak",
    cancel: "Utzi",
    save: "Gorde",
    add: "Gehitu",
    activeAlarms: "Alarma aktiboak",
    noActiveAlarms: "Ez dago alarma aktiborik.",
    untitled: "Izenbururik gabe",
    muted: "Mutua",
    edit: "Editatu",
    ringingSection: "Jotzen",
    nothingActive: "Ez dago ezer aktibo.",
    dismiss: "Baztertu",
    about: "Honi buruz",
    settings: "Ezarpenak",
    close: "Itxi",
    aboutTitle: "Puntuali buruz",
    aboutText: "Mahaigaineko alarma, bandejarekin, benetako persistentziarekin eta itxieren zein berrabiarazteen gainetik irauten duen tenporizadorearekin.",
    version: "Bertsioa",
    license: "Lizentzia",
    repository: "Biltegia",
    openRepo: "Ireki repoa",
    downloads: "Deskargak",
    checkUpdates: "Bilatu eguneraketak",
    checkingUpdates: "Argitaratutako azken release-a kontsultatzen...",
    checkUpdatesFailed: "Ezin izan da eguneraketarik dagoen egiaztatu.",
    invalidReleaseData: "GitHub-ek ez du baliozko bertsiorik itzuli.",
    upToDate: "Eguneratuta zaude. Argitaratutako azken bertsioa: {version}.",
    updateAvailable: "Bertsio berriago bat dago: {version}.",
    openRelease: "Ireki release-a",
    settingsTitle: "Ezarpenak",
    appLanguage: "Aplikazioaren hizkuntza",
    systemLanguage: "Sistemak hautemandako hizkuntza: {language}.",
    launchAtLogin: "Abiatu Puntual sistemarekin",
    launchAtLoginHelp: "Ireki aplikazioa saioa hastean eta utzi bandejan minimizatuta.",
    invalidCountdown: "Tenporizadore baliogabea.",
    invalidDate: "Data baliogabea.",
    invalidRepeatDays: "Hautatu gutxienez egun bat.",
    invalidEndDate: "Amaiera-data baliogabea.",
    invalidRepeatCount: "Errepikapen kopuru baliogabea.",
    saveFailed: "Ezin izan da gorde.",
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
    alarm: "Alarm",
    countdown: "Timer",
    dateTime: "Date and time",
    date: "Date",
    time: "Time",
    minutesShort: "Min",
    secondsShort: "Sec",
    sound: "Sound",
    customSound: "Custom sound",
    chooseSound: "Choose file",
    clearSound: "Clear sound",
    defaultSound: "Default sound",
    silent: "Silent",
    repeat: "Repeat",
    noRepeat: "Does not repeat",
    repeatDaily: "Every day",
    repeatWorkdays: "Weekdays",
    repeatWeekly: "Weekly",
    repeatMonthly: "Monthly",
    repeatYearly: "Yearly",
    repeatDays: "Days",
    monthlyPattern: "Monthly pattern",
    monthlyByDayOfMonth: "Same day of month",
    monthlyByWeekdayOfMonth: "Weekday of month",
    monthlyWeek: "Week",
    monthlyWeekDay: "Weekday",
    ends: "Ends",
    never: "Never",
    endsOnDate: "On date",
    endsAfter: "After occurrences",
    occurrences: "Times",
    noEndDate: "without end date",
    until: "until",
    dayOfMonthPrefix: "day",
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

function getMonthlyWeekFromDate(date: Date): AlarmMonthlyWeek {
  const candidate = new Date(date);
  candidate.setDate(candidate.getDate() + 7);
  if (candidate.getMonth() !== date.getMonth()) {
    return -1;
  }

  return Math.min(Math.ceil(date.getDate() / 7), 4) as Exclude<AlarmMonthlyWeek, -1>;
}

function getMonthlyPatternFromTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return {
    monthlyWeek: getMonthlyWeekFromDate(date),
    monthlyWeekDay: getWeekdayNumber(timestamp),
  };
}

function getWeekdayLongName(day: number, locale: Exclude<AppLocale, "system">) {
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.long[locale] ?? "";
}

function getMonthlyWeekLabel(week: AlarmMonthlyWeek, locale: Exclude<AppLocale, "system">) {
  return MONTHLY_WEEK_OPTIONS.find((option) => option.value === week)?.labels[locale] ?? "";
}

function getSoundLabel(soundSource: string | null) {
  if (!soundSource) {
    return null;
  }

  const tail = soundSource.split("/").pop() ?? "";
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

function createDefaultComposer(lastSoundSource: string | null = null) {
  const now = new Date();
  const monthlyPattern = getMonthlyPatternFromTimestamp(now.getTime());
  return {
    title: "",
    notes: "",
    targetDate: toInputDate(now),
    targetTime: toInputTime(now),
    countdownMinutes: "5",
    countdownSeconds: "0",
    soundEnabled: true,
    soundSource: lastSoundSource,
    repeatKind: "none" as AlarmRepeatKind,
    repeatWeekDays: [] as number[],
    repeatMonthlyMode: "dayOfMonth" as AlarmMonthlyMode,
    repeatMonthlyWeek: monthlyPattern.monthlyWeek,
    repeatMonthlyWeekDay: monthlyPattern.monthlyWeekDay,
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

async function fetchLatestRelease() {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("request-failed");
  }

  const release = (await response.json()) as { tag_name?: string; html_url?: string };
  const latestVersion = String(release.tag_name ?? "").replace(/^v/i, "");

  if (!latestVersion) {
    throw new Error("invalid-release");
  }

  return {
    latestVersion,
    url: String(release.html_url ?? APP_REPOSITORY),
  };
}

function normalizeLocale(value: string | undefined | null): Exclude<AppLocale, "system"> {
  const base = String(value ?? "").toLowerCase().split("-")[0];
  return base === "ca" || base === "en" || base === "ga" || base === "eu" ? base : "es";
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
  soundSource: string | null;
  repeatKind: AlarmRepeatKind;
  repeatWeekDays: number[];
  repeatMonthlyMode: AlarmMonthlyMode;
  repeatMonthlyWeek: AlarmMonthlyWeek;
  repeatMonthlyWeekDay: number;
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
    .map((option) => option.short[locale])
    .join(", ");
}

function formatMonthlySummary(repeat: AlarmRepeat, locale: Exclude<AppLocale, "system">, messages: MessageCatalog) {
  if (repeat.monthlyMode === "weekdayOfMonth" && repeat.monthlyWeekDay) {
    return `${messages.repeatMonthly}: ${getMonthlyWeekLabel(repeat.monthlyWeek, locale)} ${getWeekdayLongName(
      repeat.monthlyWeekDay,
      locale
    )}`;
  }

  return `${messages.repeatMonthly}: ${messages.dayOfMonthPrefix} ${new Date(repeat.anchorAt).getDate()}`;
}

function formatRepeatSummary(repeat: AlarmRepeat, locale: Exclude<AppLocale, "system">, messages: MessageCatalog) {
  if (repeat.kind === "none") {
    return messages.noRepeat;
  }

  const base =
    repeat.kind === "weekly" && repeat.weekDays.length > 0
      ? `${messages.repeatWeekly}: ${formatWeekDayList(repeat.weekDays, locale)}`
      : repeat.kind === "monthly"
        ? formatMonthlySummary(repeat, locale, messages)
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
      monthlyMode: "dayOfMonth",
      monthlyWeek: 1,
      monthlyWeekDay: null,
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

  const monthlyWeekDay =
    composer.repeatKind === "monthly" && composer.repeatMonthlyMode === "weekdayOfMonth"
      ? composer.repeatMonthlyWeekDay
      : null;

  if (composer.repeatEndType === "onDate") {
    const endAt = toEndOfDayTimestamp(composer.repeatEndDate);
    if (endAt === null || endAt < targetAt) {
      return null;
    }
    return {
      kind: composer.repeatKind,
      weekDays,
      monthlyMode: composer.repeatKind === "monthly" ? composer.repeatMonthlyMode : "dayOfMonth",
      monthlyWeek: composer.repeatKind === "monthly" ? composer.repeatMonthlyWeek : 1,
      monthlyWeekDay,
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
      monthlyMode: composer.repeatKind === "monthly" ? composer.repeatMonthlyMode : "dayOfMonth",
      monthlyWeek: composer.repeatKind === "monthly" ? composer.repeatMonthlyWeek : 1,
      monthlyWeekDay,
      endType: "afterCount",
      endAt: null,
      maxOccurrences,
    };
  }

  return {
    kind: composer.repeatKind,
    weekDays,
    monthlyMode: composer.repeatKind === "monthly" ? composer.repeatMonthlyMode : "dayOfMonth",
    monthlyWeek: composer.repeatKind === "monthly" ? composer.repeatMonthlyWeek : 1,
    monthlyWeekDay,
    endType: "never",
    endAt: null,
    maxOccurrences: null,
  };
}

function App() {
  const [state, setState] = useState<AlarmState>(fallbackState);
  const [composer, setComposer] = useState<ComposerState>(() => createDefaultComposer());
  const [scheduleMode, setScheduleMode] = useState<"absolute" | "countdown">("absolute");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [ringing, setRinging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const soundFileInputRef = useRef<HTMLInputElement | null>(null);
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
      setComposer((current) => ({ ...current, soundSource: nextState.settings.lastSoundSource }));
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
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const lastCheckAt = Number.parseInt(window.localStorage.getItem(AUTO_UPDATE_CHECK_KEY) ?? "0", 10);
    if (Number.isFinite(lastCheckAt) && Date.now() - lastCheckAt < ONE_DAY_MS) {
      return;
    }

    window.localStorage.setItem(AUTO_UPDATE_CHECK_KEY, String(Date.now()));
    void (async () => {
      try {
        const { latestVersion, url } = await fetchLatestRelease();
        if (compareVersions(latestVersion, APP_VERSION) > 0) {
          setUpdateStatus({
            kind: "available",
            version: latestVersion,
            url,
          });
        }
      } catch {
        // Silent daily background check.
      }
    })();
  }, []);

  const scheduled = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "scheduled").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const ringingAlarms = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "ringing").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );
  const activeSoundSource = ringingAlarms.find((alarm) => alarm.soundEnabled)?.soundSource ?? ALARM_SOUND_PATH;

  useEffect(() => {
    let cancelled = false;

    const play = async () => {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.loop = true;

      if (!ringing) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      let playableUrl = activeSoundSource;
      if (activeSoundSource.startsWith("file://")) {
        const { buffer, mimeType } = await window.alarmApi.readSoundFile(activeSoundSource);
        if (cancelled) {
          return;
        }
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        }
        const blobBytes = Uint8Array.from(buffer) as unknown as BlobPart;
        audioObjectUrlRef.current = URL.createObjectURL(new Blob([blobBytes], { type: mimeType }));
        playableUrl = audioObjectUrlRef.current;
      }

      if (audio.src !== playableUrl) {
        audio.src = playableUrl;
        audio.load();
      }

      void audio.play().catch(() => undefined);
    };

    void play();

    return () => {
      cancelled = true;
    };
  }, [activeSoundSource, ringing]);

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

  function resetComposer(lastSoundSource = state.settings.lastSoundSource, nextMode = scheduleMode) {
    setComposer(createDefaultComposer(lastSoundSource));
    setScheduleMode(nextMode);
    setEditingId(null);
    setError("");
  }

  function startEditing(alarm: Alarm) {
    setEditingId(alarm.id);
    setError("");
    const monthlyPattern = getMonthlyPatternFromTimestamp(alarm.targetAt);
    setComposer({
      title: alarm.title,
      notes: alarm.notes,
      targetDate: toInputDate(new Date(alarm.targetAt)),
      targetTime: toInputTime(new Date(alarm.targetAt)),
      countdownMinutes: "5",
      countdownSeconds: "0",
      soundEnabled: alarm.soundEnabled,
      soundSource: alarm.soundSource,
      repeatKind: alarm.repeat.kind,
      repeatWeekDays: [...alarm.repeat.weekDays],
      repeatMonthlyMode: alarm.repeat.monthlyMode,
      repeatMonthlyWeek: alarm.repeat.kind === "monthly" ? alarm.repeat.monthlyWeek : monthlyPattern.monthlyWeek,
      repeatMonthlyWeekDay:
        alarm.repeat.kind === "monthly"
          ? (alarm.repeat.monthlyWeekDay ?? monthlyPattern.monthlyWeekDay)
          : monthlyPattern.monthlyWeekDay,
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
        monthlyMode: "dayOfMonth",
        monthlyWeek: 1,
        monthlyWeekDay: null,
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
      soundSource: composer.soundSource,
      repeat,
    };

    try {
      const nextState = editingId
        ? await window.alarmApi.updateAlarm({ ...payload, id: editingId })
        : await window.alarmApi.createAlarm(payload);
      setState(nextState);
      resetComposer(nextState.settings.lastSoundSource);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : messages.saveFailed);
    }
  }

  async function importSelectedSound(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const imported = await window.alarmApi.importSoundFile({
        name: file.name,
        buffer: await file.arrayBuffer(),
      });
      setComposer((current) => ({ ...current, soundSource: imported.url, soundEnabled: true }));
      setError("");
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

  async function checkForUpdates(options?: { silent?: boolean }) {
    const silent = options?.silent === true;

    if (!silent) {
      setUpdateStatus({ kind: "checking" });
    }

    try {
      const { latestVersion, url } = await fetchLatestRelease();

      if (compareVersions(latestVersion, APP_VERSION) > 0) {
        setUpdateStatus({
          kind: "available",
          version: latestVersion,
          url,
        });
        return;
      }

      if (!silent) {
        setUpdateStatus({ kind: "up-to-date", version: latestVersion });
      } else if (updateStatus.kind !== "available") {
        setUpdateStatus({ kind: "idle" });
      }
    } catch (caughtError) {
      if (!silent) {
        setUpdateStatus({
          kind: "error",
          message:
            caughtError instanceof Error && caughtError.message === "invalid-release"
              ? messages.invalidReleaseData
              : messages.checkUpdatesFailed,
        });
      }
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
          <input
            ref={soundFileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,audio/*"
            hidden
            onChange={(event) => void importSelectedSound(event)}
          />
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
              className={scheduleMode === "absolute" ? "toggle-button active" : "toggle-button"}
              onClick={() => setScheduleMode("absolute")}
            >
              <CalendarClock size={13} />
              {messages.alarm}
            </button>
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
              <Clock3 size={13} />
              {messages.countdown}
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
                      const nextTargetAt = parseAbsoluteTarget(nextDate, composer.targetTime);
                      const nextMonthlyPattern =
                        Number.isFinite(nextTargetAt) ? getMonthlyPatternFromTimestamp(nextTargetAt) : null;
                      setComposer((current) => ({
                        ...current,
                        targetDate: nextDate,
                        repeatWeekDays:
                          current.repeatKind === "weekly" && current.repeatWeekDays.length === 0 && nextDate && current.targetTime
                            ? [getWeekdayNumber(parseAbsoluteTarget(nextDate, current.targetTime))]
                            : current.repeatWeekDays,
                        repeatMonthlyWeek:
                          current.repeatKind === "monthly" && current.repeatMonthlyMode === "weekdayOfMonth" && nextMonthlyPattern
                            ? nextMonthlyPattern.monthlyWeek
                            : current.repeatMonthlyWeek,
                        repeatMonthlyWeekDay:
                          current.repeatKind === "monthly" && current.repeatMonthlyMode === "weekdayOfMonth" && nextMonthlyPattern
                            ? nextMonthlyPattern.monthlyWeekDay
                            : current.repeatMonthlyWeekDay,
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
                    const nextMonthlyPattern =
                      Number.isFinite(nextTargetAt) ? getMonthlyPatternFromTimestamp(nextTargetAt) : null;
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
                      repeatMonthlyMode: nextKind === "monthly" ? current.repeatMonthlyMode : "dayOfMonth",
                      repeatMonthlyWeek: nextKind === "monthly" && nextMonthlyPattern ? nextMonthlyPattern.monthlyWeek : current.repeatMonthlyWeek,
                      repeatMonthlyWeekDay:
                        nextKind === "monthly" && nextMonthlyPattern ? nextMonthlyPattern.monthlyWeekDay : current.repeatMonthlyWeekDay,
                      repeatEndType: nextKind === "none" ? "never" : current.repeatEndType,
                    }));
                  }}
                >
                  <option value="none">{messages.noRepeat}</option>
                  <option value="daily">{messages.repeatDaily}</option>
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
                          {option.short[appLocale]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {composer.repeatKind === "monthly" ? (
                <>
                  <label className="field-block">
                    <span>{messages.monthlyPattern}</span>
                    <select
                      className="settings-select"
                      value={composer.repeatMonthlyMode}
                      onChange={(event) => {
                        const nextMode = event.target.value as AlarmMonthlyMode;
                        const nextTargetAt = parseAbsoluteTarget(composer.targetDate, composer.targetTime);
                        const nextMonthlyPattern =
                          Number.isFinite(nextTargetAt) ? getMonthlyPatternFromTimestamp(nextTargetAt) : null;
                        setComposer((current) => ({
                          ...current,
                          repeatMonthlyMode: nextMode,
                          repeatMonthlyWeek:
                            nextMode === "weekdayOfMonth" && nextMonthlyPattern
                              ? nextMonthlyPattern.monthlyWeek
                              : current.repeatMonthlyWeek,
                          repeatMonthlyWeekDay:
                            nextMode === "weekdayOfMonth" && nextMonthlyPattern
                              ? nextMonthlyPattern.monthlyWeekDay
                              : current.repeatMonthlyWeekDay,
                        }));
                      }}
                    >
                      <option value="dayOfMonth">{messages.monthlyByDayOfMonth}</option>
                      <option value="weekdayOfMonth">{messages.monthlyByWeekdayOfMonth}</option>
                    </select>
                  </label>

                  {composer.repeatMonthlyMode === "weekdayOfMonth" ? (
                    <div className="field-grid">
                      <label className="field-block">
                        <span>{messages.monthlyWeek}</span>
                        <select
                          className="settings-select"
                          value={String(composer.repeatMonthlyWeek)}
                          onChange={(event) =>
                            setComposer((current) => ({
                              ...current,
                              repeatMonthlyWeek: Number.parseInt(event.target.value, 10) as AlarmMonthlyWeek,
                            }))
                          }
                        >
                          {MONTHLY_WEEK_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.labels[appLocale]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field-block">
                        <span>{messages.monthlyWeekDay}</span>
                        <select
                          className="settings-select"
                          value={String(composer.repeatMonthlyWeekDay)}
                          onChange={(event) =>
                            setComposer((current) => ({
                              ...current,
                              repeatMonthlyWeekDay: Number.parseInt(event.target.value, 10),
                            }))
                          }
                        >
                          {WEEKDAY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.long[appLocale]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </>
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
                        monthlyMode: composer.repeatMonthlyMode,
                        monthlyWeek: composer.repeatMonthlyWeek,
                        monthlyWeekDay: composer.repeatMonthlyMode === "weekdayOfMonth" ? composer.repeatMonthlyWeekDay : null,
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
            <button type="button" className="secondary-button" onClick={() => soundFileInputRef.current?.click()}>
              <FolderOpen size={13} />
              {messages.chooseSound}
            </button>
            {composer.soundSource ? (
              <button
                type="button"
                className="icon-button"
                onClick={() => setComposer((current) => ({ ...current, soundSource: null }))}
                aria-label={messages.clearSound}
                title={messages.clearSound}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          <div className="repeat-summary">
            {messages.customSound}: {getSoundLabel(composer.soundSource) ?? messages.defaultSound}
          </div>

          <textarea
            value={composer.notes}
            onChange={(event) => setComposer((current) => ({ ...current, notes: event.target.value }))}
            placeholder={messages.notes}
            rows={2}
          />

          {error ? <div className="error-banner">{error}</div> : null}

          {editingId ? (
            <button type="button" className="secondary-button full-width" onClick={() => resetComposer()}>
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
                {(["system", "es", "ca", "en", "ga", "eu"] as AppLocale[]).map((locale) => (
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
              <button type="button" className="secondary-button" onClick={() => void checkForUpdates()}>
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
