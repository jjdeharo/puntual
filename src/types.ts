export type AlarmStatus = "scheduled" | "ringing" | "dismissed";
export type AppLocale = "system" | "es" | "ca" | "en";
export type AlarmRepeatKind = "none" | "daily" | "workdays" | "weekly" | "monthly" | "yearly";
export type AlarmRepeatEndType = "never" | "onDate" | "afterCount";

export type AlarmRepeat = {
  kind: AlarmRepeatKind;
  weekDays: number[];
  endType: AlarmRepeatEndType;
  endAt: number | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
  anchorAt: number;
};

export type AlarmRepeatInput = {
  kind: AlarmRepeatKind;
  weekDays: number[];
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
  status: AlarmStatus;
  acknowledgedAt: number | null;
};

export type AlarmSettings = {
  launchAtLogin: boolean;
  silenceWhileWindowOpen: boolean;
  locale: AppLocale;
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
      showWindow: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onState: (listener: (state: AlarmState) => void) => () => void;
      onRingState: (listener: (ringing: boolean) => void) => () => void;
    };
  }
}

export {};
