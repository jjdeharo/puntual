export type AlarmStatus = "scheduled" | "ringing" | "dismissed";

export type Alarm = {
  id: string;
  title: string;
  notes: string;
  targetAt: number;
  createdAt: number;
  updatedAt: number;
  soundEnabled: boolean;
  status: AlarmStatus;
  acknowledgedAt: number | null;
};

export type AlarmSettings = {
  launchAtLogin: boolean;
  silenceWhileWindowOpen: boolean;
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
};

declare global {
  interface Window {
    alarmApi: {
      getState: () => Promise<AlarmState>;
      createAlarm: (payload: AlarmInput) => Promise<AlarmState>;
      updateAlarm: (payload: AlarmInput & { id: string }) => Promise<AlarmState>;
      dismissAlarm: (id: string) => Promise<AlarmState>;
      deleteAlarm: (id: string) => Promise<AlarmState>;
      setLaunchAtLogin: (enabled: boolean) => Promise<AlarmState>;
      showWindow: () => Promise<void>;
      onState: (listener: (state: AlarmState) => void) => () => void;
      onRingState: (listener: (ringing: boolean) => void) => () => void;
    };
  }
}

export {};
