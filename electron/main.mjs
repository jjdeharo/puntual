import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, nativeTheme, shell } from "electron";
import { createAlarmStore } from "./alarm-store.mjs";
import { advanceAlarm, createStoredRepeat } from "./recurrence.mjs";
import { createAlarmScheduler } from "./scheduler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const isAutoLaunch = process.argv.includes("--autostart");
const linuxAutoStartDesktopFileName = "io.jjdeharo.puntual.desktop";

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
  return `file://${path.join(__dirname, "..", "dist", "renderer", "index.html")}`;
}

function syncLaunchAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: ["--autostart"],
  });

  if (process.platform === "linux") {
    syncLinuxAutoStart(enabled);
  }
}

function syncLinuxAutoStart(enabled) {
  try {
    const desktopEntryPath = getLinuxAutoStartDesktopEntryPath();

    if (!desktopEntryPath) {
      return;
    }

    if (!enabled) {
      fs.rmSync(desktopEntryPath, { force: true });
      return;
    }

    const execPath = getLinuxAutoStartExecPath();
    if (!execPath) {
      log("linux autostart skipped: executable path unavailable");
      return;
    }

    fs.mkdirSync(path.dirname(desktopEntryPath), { recursive: true });
    fs.writeFileSync(desktopEntryPath, buildLinuxAutoStartDesktopEntry(execPath), "utf8");
  } catch (error) {
    log("linux autostart sync failed", error);
  }
}

function getLinuxAutoStartDesktopEntryPath() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "autostart", linuxAutoStartDesktopFileName);
}

function getLinuxAutoStartExecPath() {
  const appImagePath = process.env.APPIMAGE;
  if (appImagePath) {
    return appImagePath;
  }

  const executablePath = app.getPath("exe");
  if (executablePath) {
    return executablePath;
  }

  return null;
}

function buildLinuxAutoStartDesktopEntry(execPath) {
  const quotedExec = quoteDesktopEntryValue(execPath);
  const iconPath = quoteDesktopEntryValue(path.join(__dirname, "notification-icon.png"));

  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=Puntual",
    "Comment=Alarma de escritorio con bandeja del sistema",
    `Exec=${quotedExec} --autostart`,
    `Icon=${iconPath}`,
    "Terminal=false",
    "StartupNotify=false",
    "Categories=Utility;",
    "X-GNOME-Autostart-enabled=true",
  ].join("\n");
}

function quoteDesktopEntryValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function sanitizeImportedFileName(value) {
  const base = path.basename(String(value ?? "sound")).replace(/[^\w.-]+/g, "-");
  return base || "sound";
}

function getAudioMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
    case ".oga":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 560,
    minWidth: 760,
    minHeight: 500,
    show: false,
    title: "Puntual",
    icon: path.join(__dirname, "tray-icon.png"),
    backgroundColor: getWindowBackgroundColor(),
    autoHideMenuBar: true,
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" } : {}),
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
    if (isAutoLaunch) {
      return;
    }
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

function getWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? "#0b1117" : "#f3f5f7";
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
  return nativeImage
    .createFromPath(path.join(__dirname, "tray-icon.png"))
    .resize({ width: 18, height: 18 });
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

function normalizeLocale(value) {
  const base = String(value ?? "").toLowerCase().split("-")[0];
  return base === "ca" || base === "en" || base === "ga" || base === "eu" ? base : "es";
}

function getResolvedLocale(setting = store.getState().settings.locale) {
  return setting === "system" ? normalizeLocale(app.getLocale()) : normalizeLocale(setting);
}

function t(state, key, variables = {}) {
  const locale = getResolvedLocale(state?.settings?.locale);
  const dictionaries = {
    es: {
      tray_idle: "Puntual",
      tray_ringing: "{count} sonando",
      tray_next: "Próxima alarma a las {time}",
      tray_open: "Abrir Puntual",
      tray_silence: "Silenciar {count} alarma{suffix}",
      tray_none_ringing: "No hay alarmas sonando",
      tray_next_item: "Siguiente: {value}",
      tray_none_scheduled: "Sin alarmas programadas",
      tray_quit: "Salir",
    },
    ca: {
      tray_idle: "Puntual",
      tray_ringing: "{count} sonant",
      tray_next: "Pròxima alarma a les {time}",
      tray_open: "Obrir Puntual",
      tray_silence: "Silencia {count} alarma{suffix}",
      tray_none_ringing: "No hi ha alarmes sonant",
      tray_next_item: "Següent: {value}",
      tray_none_scheduled: "No hi ha alarmes programades",
      tray_quit: "Sortir",
    },
    ga: {
      tray_idle: "Puntual",
      tray_ringing: "{count} soando",
      tray_next: "Próxima alarma ás {time}",
      tray_open: "Abrir Puntual",
      tray_silence: "Silenciar {count} alarma{suffix}",
      tray_none_ringing: "Non hai alarmas soando",
      tray_next_item: "Seguinte: {value}",
      tray_none_scheduled: "Sen alarmas programadas",
      tray_quit: "Saír",
    },
    eu: {
      tray_idle: "Puntual",
      tray_ringing: "{count} jotzen",
      tray_next: "Hurrengo alarma: {time}",
      tray_open: "Ireki Puntual",
      tray_silence: "Isilarazi {count} alarma{suffix}",
      tray_none_ringing: "Ez dago alarmarik jotzen",
      tray_next_item: "Hurrengoa: {value}",
      tray_none_scheduled: "Ez dago alarmarik programatuta",
      tray_quit: "Irten",
    },
    en: {
      tray_idle: "Puntual",
      tray_ringing: "{count} ringing",
      tray_next: "Next alarm at {time}",
      tray_open: "Open Puntual",
      tray_silence: "Silence {count} alarm{suffix}",
      tray_none_ringing: "No alarms ringing",
      tray_next_item: "Next: {value}",
      tray_none_scheduled: "No alarms scheduled",
      tray_quit: "Quit",
    },
  };

  const template = dictionaries[locale][key] ?? dictionaries.es[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, token) => String(variables[token] ?? ""));
}

function refreshTrayMenu(state) {
  if (!tray) {
    return;
  }

  const nextAlarm = state.alarms.find((alarm) => alarm.status === "scheduled");
  const ringingCount = state.alarms.filter((alarm) => alarm.status === "ringing").length;

  tray.setToolTip(
    ringingCount > 0
      ? `Puntual: ${t(state, "tray_ringing", { count: ringingCount })}`
      : nextAlarm
        ? t(state, "tray_next", {
            time: new Date(nextAlarm.targetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          })
        : t(state, "tray_idle")
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: t(state, "tray_open"),
      click: () => showWindow(),
    },
    {
      label:
        ringingCount > 0
          ? t(state, "tray_silence", { count: ringingCount, suffix: ringingCount > 1 ? "s" : "" })
          : t(state, "tray_none_ringing"),
      enabled: ringingCount > 0,
      click: () => dismissAllRinging(),
    },
    { type: "separator" },
    {
      label: nextAlarm
        ? t(state, "tray_next_item", { value: new Date(nextAlarm.targetAt).toLocaleString() })
        : t(state, "tray_none_scheduled"),
      enabled: false,
    },
    { type: "separator" },
    {
      label: t(state, "tray_quit"),
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
  const soundSource =
    typeof payload?.soundSource === "string" && payload.soundSource.startsWith("file://") ? payload.soundSource : null;

  if (requireId && !payload?.id) {
    throw new Error("Falta el id de la alarma.");
  }
  if (!Number.isFinite(targetAt)) {
    throw new Error("La fecha de la alarma no es válida.");
  }
  if (targetAt <= Date.now()) {
    throw new Error("La alarma debe programarse en el futuro.");
  }

  const repeat = createStoredRepeat(payload?.repeat, targetAt);

  if (repeat.kind === "weekly" && repeat.weekDays.length === 0) {
    throw new Error("Selecciona al menos un día para la repetición semanal.");
  }
  if (repeat.kind === "monthly" && repeat.monthlyMode === "weekdayOfMonth" && !repeat.monthlyWeekDay) {
    throw new Error("El patrón mensual no es válido.");
  }
  if (repeat.endType === "onDate" && !Number.isFinite(repeat.endAt)) {
    throw new Error("La fecha de fin no es válida.");
  }
  if (repeat.endType === "onDate" && repeat.endAt < targetAt) {
    throw new Error("La fecha de fin debe ser igual o posterior a la primera alarma.");
  }
  if (repeat.endType === "afterCount" && (!Number.isInteger(repeat.maxOccurrences) || repeat.maxOccurrences < 1)) {
    throw new Error("El número de repeticiones debe ser mayor que cero.");
  }

  return {
    id: requireId ? String(payload.id) : crypto.randomUUID(),
    title,
    notes,
    targetAt,
    soundEnabled,
    soundSource,
    repeat,
  };
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  nativeTheme.themeSource = "system";
  nativeTheme.on("updated", () => {
    mainWindow?.setBackgroundColor(getWindowBackgroundColor());
  });

  syncLaunchAtLogin(store.getState().settings.launchAtLogin);

  scheduler.start();
  sendState(store.getState());

  ipcMain.handle("alarm:get-state", () => store.getState());
  ipcMain.handle("app:open-external", (_event, targetUrl) => {
    if (typeof targetUrl !== "string" || !/^https?:\/\//.test(targetUrl)) {
      throw new Error("URL externa no válida.");
    }
    return shell.openExternal(targetUrl);
  });

  ipcMain.handle("dialog:choose-sound-file", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Selecciona un sonido",
      properties: ["openFile"],
      filters: [
        { name: "Audio", extensions: ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac"] },
        { name: "Todos los archivos", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    return {
      url: pathToFileURL(filePath).href,
      name: path.basename(filePath),
    };
  });

  ipcMain.handle("sound:import-file", async (_event, payload) => {
    const name = sanitizeImportedFileName(payload?.name);
    const extension = path.extname(name).toLowerCase();
    const allowedExtensions = new Set([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac"]);
    if (!allowedExtensions.has(extension)) {
      throw new Error("Formato de audio no permitido.");
    }

    const sourceBuffer = payload?.buffer;
    if (!(sourceBuffer instanceof ArrayBuffer) || sourceBuffer.byteLength === 0) {
      throw new Error("Archivo de audio no válido.");
    }

    const soundsDir = path.join(app.getPath("userData"), "sounds");
    fs.mkdirSync(soundsDir, { recursive: true });
    const targetFileName = `${crypto.randomUUID()}-${name}`;
    const targetPath = path.join(soundsDir, targetFileName);
    fs.writeFileSync(targetPath, Buffer.from(sourceBuffer));

    return {
      url: pathToFileURL(targetPath).href,
      name,
    };
  });

  ipcMain.handle("sound:read-file", async (_event, targetUrl) => {
    if (typeof targetUrl !== "string" || !targetUrl.startsWith("file://")) {
      throw new Error("Ruta de sonido no válida.");
    }

    const filePath = fileURLToPath(targetUrl);
    const fileBuffer = fs.readFileSync(filePath);
    return {
      buffer: Uint8Array.from(fileBuffer),
      mimeType: getAudioMimeType(filePath),
    };
  });

  ipcMain.handle("alarm:create", (_event, payload) => {
    const input = validateAlarmInput(payload, false);
    const now = Date.now();
    const nextState = store.mutate((current) => ({
      ...current,
      settings: { ...current.settings, lastSoundSource: input.soundSource },
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
      settings: { ...current.settings, lastSoundSource: input.soundSource },
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
      alarms: current.alarms.map((alarm) => (alarm.id === id ? advanceAlarm(alarm, now) : alarm)),
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

    syncLaunchAtLogin(launchAtLogin);
    sendState(nextState);
    return nextState;
  });

  ipcMain.handle("settings:set-locale", (_event, locale) => {
    const nextLocale = locale === "es" || locale === "ca" || locale === "en" || locale === "system" ? locale : "system";
    const nextState = store.mutate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        locale: nextLocale,
      },
    }));
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
