const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alarmApi", {
  getState: () => ipcRenderer.invoke("alarm:get-state"),
  createAlarm: (payload) => ipcRenderer.invoke("alarm:create", payload),
  updateAlarm: (payload) => ipcRenderer.invoke("alarm:update", payload),
  dismissAlarm: (id) => ipcRenderer.invoke("alarm:dismiss", id),
  snoozeAlarm: (id, duration) => ipcRenderer.invoke("alarm:snooze", { id, duration }),
  dismissAllRinging: () => ipcRenderer.invoke("alarm:dismiss-all-ringing"),
  snoozeRinging: (duration) => ipcRenderer.invoke("alarm:snooze-ringing", duration),
  setAlarmPopupExpanded: (expanded) => ipcRenderer.invoke("alarm-popup:set-expanded", expanded),
  deleteAlarm: (id) => ipcRenderer.invoke("alarm:delete", id),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("settings:set-launch-at-login", enabled),
  setLocale: (locale) => ipcRenderer.invoke("settings:set-locale", locale),
  chooseSoundFile: () => ipcRenderer.invoke("dialog:choose-sound-file"),
  importSoundFile: (payload) => ipcRenderer.invoke("sound:import-file", payload),
  readSoundFile: (url) => ipcRenderer.invoke("sound:read-file", url),
  showWindow: () => ipcRenderer.invoke("app:show-window"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  onState: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("state:sync", wrapped);
    return () => ipcRenderer.removeListener("state:sync", wrapped);
  },
  onRingState: (listener) => {
    const wrapped = (_event, ringing) => listener(ringing);
    ipcRenderer.on("alarm:ring-state", wrapped);
    return () => ipcRenderer.removeListener("alarm:ring-state", wrapped);
  },
});
