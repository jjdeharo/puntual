export type AlarmStatus = "scheduled" | "ringing" | "dismissed";
export type AppLocale = "system" | "es" | "ca" | "en" | "ga" | "eu";
export type AlarmRepeatKind = "none" | "daily" | "workdays" | "weekly" | "monthly" | "yearly";
export type AlarmRepeatEndType = "never" | "onDate" | "afterCount";
export type AlarmMonthlyMode = "dayOfMonth" | "weekdayOfMonth";
export type AlarmMonthlyWeek = 1 | 2 | 3 | 4 | -1;

export type AlarmRepeat = {
  kind: AlarmRepeatKind;
  weekDays: number[];
  monthlyMode: AlarmMonthlyMode;
  monthlyWeek: AlarmMonthlyWeek;
  monthlyWeekDay: number | null;
  endType: AlarmRepeatEndType;
  endAt: number | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
  anchorAt: number;
};

export type AlarmRepeatInput = {
  kind: AlarmRepeatKind;
  weekDays: number[];
  monthlyMode: AlarmMonthlyMode;
  monthlyWeek: AlarmMonthlyWeek;
  monthlyWeekDay: number | null;
  endType: AlarmRepeatEndType;
  endAt: number | null;
  maxOccurrences: number | null;
};

export type Alarm = {
  id: string;
  title: string;
  notes: string;
  targetAt: number;
  repeat: AlarmRepeat;
  createdAt: number;
  updatedAt: number;
  soundEnabled: boolean;
  soundSource: string | null;
  status: AlarmStatus;
  acknowledgedAt: number | null;
};

export type AlarmSettings = {
  launchAtLogin: boolean;
  silenceWhileWindowOpen: boolean;
  locale: AppLocale;
  lastSoundSource: string | null;
};

export type AlarmState = {
  alarms: Alarm[];
  settings: AlarmSettings;
};

export type AlarmInput = {
  title: string;
  notes: string;
  targetAt: number;
  soundEnabled: boolean;
  soundSource: string | null;
  repeat: AlarmRepeatInput;
};

declare global {
  const __APP_VERSION__: string;
  const __APP_LICENSE__: string;
  const __APP_REPOSITORY__: string;

  interface Window {
    alarmApi: {
      getState: () => Promise<AlarmState>;
      createAlarm: (payload: AlarmInput) => Promise<AlarmState>;
      updateAlarm: (payload: AlarmInput & { id: string }) => Promise<AlarmState>;
      dismissAlarm: (id: string) => Promise<AlarmState>;
      deleteAlarm: (id: string) => Promise<AlarmState>;
      setLaunchAtLogin: (enabled: boolean) => Promise<AlarmState>;
      setLocale: (locale: AppLocale) => Promise<AlarmState>;
      chooseSoundFile: () => Promise<{ url: string; name: string } | null>;
      importSoundFile: (payload: { name: string; buffer: ArrayBuffer }) => Promise<{ url: string; name: string }>;
      readSoundFile: (url: string) => Promise<{ buffer: Uint8Array; mimeType: string }>;
      showWindow: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onState: (listener: (state: AlarmState) => void) => () => void;
      onRingState: (listener: (ringing: boolean) => void) => () => void;
    };
  }
}

export {};
