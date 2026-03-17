import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import { createAlarmStore } from "./alarm-store.mjs";
import { createAlarmScheduler } from "./scheduler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;
let isQuitting = false;

const store = createAlarmStore(path.join(app.getPath("userData"), "alarms.json"));

function log(...args) {
  console.log("[puntual]", ...args);
}

function getWindowUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }
  return `file://${path.join(__dirname, "..", "dist", "index.html")}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    show: false,
    title: "Puntual",
    backgroundColor: "#f3f5f7",
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(getWindowUrl());

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    log("did-fail-load", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log("render-process-gone", details);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("console-message", { level, message, line, sourceId });
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("did-finish-load", mainWindow?.webContents.getURL());
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    mainWindow?.hide();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Puntual");
  tray.addListener("click", () => {
    toggleWindow();
  });
  refreshTrayMenu(store.getState());
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <g fill="none" stroke="#f7f9fb" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 18 14 10"/>
        <path d="M44 18 50 10"/>
        <circle cx="32" cy="34" r="18"/>
        <path d="M32 24v11l8 6"/>
      </g>
    </svg>
  `;
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  return icon.resize({ width: 22, height: 22 });
}

function toggleWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function sendState(state = store.getState()) {
  mainWindow?.webContents.send("state:sync", state);
  refreshTrayMenu(state);
}

function refreshTrayMenu(state) {
  if (!tray) {
    return;
  }

  const nextAlarm = state.alarms.find((alarm) => alarm.status === "scheduled");
  const ringingCount = state.alarms.filter((alarm) => alarm.status === "ringing").length;

  tray.setToolTip(
    ringingCount > 0
      ? `Puntual: ${ringingCount} sonando`
      : nextAlarm
        ? `Próxima alarma a las ${new Date(nextAlarm.targetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Puntual"
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir Puntual",
      click: () => showWindow(),
    },
    {
      label: ringingCount > 0 ? `Silenciar ${ringingCount} alarma${ringingCount > 1 ? "s" : ""}` : "No hay alarmas sonando",
      enabled: ringingCount > 0,
      click: () => dismissAllRinging(),
    },
    { type: "separator" },
    {
      label: nextAlarm
        ? `Siguiente: ${new Date(nextAlarm.targetAt).toLocaleString()}`
        : "Sin alarmas programadas",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function dismissAllRinging() {
  const now = Date.now();
  const nextState = store.mutate((current) => ({
    ...current,
    alarms: current.alarms.map((alarm) =>
      alarm.status === "ringing"
        ? { ...alarm, status: "dismissed", acknowledgedAt: now, updatedAt: now }
        : alarm
    ),
  }));
  sendState(nextState);
  scheduler.evaluate(false);
}

const scheduler = createAlarmScheduler({
  store,
  onStateChange: (state) => sendState(state),
  onRingStateChange: (ringing) => mainWindow?.webContents.send("alarm:ring-state", ringing),
});

function validateAlarmInput(payload, requireId = false) {
  const title = String(payload?.title ?? "").trim();
  const notes = String(payload?.notes ?? "").trim();
  const targetAt = Number(payload?.targetAt);
  const soundEnabled = payload?.soundEnabled !== false;

  if (requireId && !payload?.id) {
    throw new Error("Falta el id de la alarma.");
  }
  if (!Number.isFinite(targetAt)) {
    throw new Error("La fecha de la alarma no es válida.");
  }
  if (targetAt <= Date.now()) {
    throw new Error("La alarma debe programarse en el futuro.");
  }

  return {
    id: requireId ? String(payload.id) : crypto.randomUUID(),
    title,
    notes,
    targetAt,
    soundEnabled,
  };
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.setLoginItemSettings({
    openAtLogin: store.getState().settings.launchAtLogin,
  });

  scheduler.start();
  sendState(store.getState());

  ipcMain.handle("alarm:get-state", () => store.getState());

  ipcMain.handle("alarm:create", (_event, payload) => {
    const input = validateAlarmInput(payload, false);
    const now = Date.now();
    const nextState = store.mutate((current) => ({
      ...current,
      alarms: [
        ...current.alarms,
        {
          ...input,
          status: "scheduled",
          createdAt: now,
          updatedAt: now,
          acknowledgedAt: null,
        },
      ],
    }));
    sendState(nextState);
    scheduler.evaluate(false);
    return nextState;
  });

  ipcMain.handle("alarm:update", (_event, payload) => {
    const input = validateAlarmInput(payload, true);
    const nextState = store.mutate((current) => ({
      ...current,
      alarms: current.alarms.map((alarm) =>
        alarm.id === input.id
          ? {
              ...alarm,
              ...input,
              status: "scheduled",
              acknowledgedAt: null,
              updatedAt: Date.now(),
            }
          : alarm
      ),
    }));
    sendState(nextState);
    scheduler.evaluate(false);
    return nextState;
  });

  ipcMain.handle("alarm:dismiss", (_event, id) => {
    const now = Date.now();
    const nextState = store.mutate((current) => ({
      ...current,
      alarms: current.alarms.map((alarm) =>
        alarm.id === id
          ? {
              ...alarm,
              status: "dismissed",
              acknowledgedAt: now,
              updatedAt: now,
            }
          : alarm
      ),
    }));
    sendState(nextState);
    scheduler.evaluate(false);
    return nextState;
  });

  ipcMain.handle("alarm:delete", (_event, id) => {
    const nextState = store.mutate((current) => ({
      ...current,
      alarms: current.alarms.filter((alarm) => alarm.id !== id),
    }));
    sendState(nextState);
    scheduler.evaluate(false);
    return nextState;
  });

  ipcMain.handle("settings:set-launch-at-login", (_event, enabled) => {
    const launchAtLogin = Boolean(enabled);
    const nextState = store.mutate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        launchAtLogin,
      },
    }));

    app.setLoginItemSettings({ openAtLogin: launchAtLogin });
    sendState(nextState);
    return nextState;
  });

  ipcMain.handle("app:show-window", () => {
    showWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }
    showWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
