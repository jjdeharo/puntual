const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alarmApi", {
  getState: () => ipcRenderer.invoke("alarm:get-state"),
  createAlarm: (payload) => ipcRenderer.invoke("alarm:create", payload),
  updateAlarm: (payload) => ipcRenderer.invoke("alarm:update", payload),
  dismissAlarm: (id) => ipcRenderer.invoke("alarm:dismiss", id),
  deleteAlarm: (id) => ipcRenderer.invoke("alarm:delete", id),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("settings:set-launch-at-login", enabled),
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
