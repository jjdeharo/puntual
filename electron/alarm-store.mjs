import fs from "node:fs";
import path from "node:path";
import { normalizeStoredRepeat } from "./recurrence.mjs";

const DEFAULT_STATE = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
    locale: "system",
    lastSoundSource: null,
  },
};

export function createAlarmStore(filePath) {
  const directory = path.dirname(filePath);
  let state = loadInitialState(filePath);

  function ensureDirectory() {
    fs.mkdirSync(directory, { recursive: true });
  }

  function loadInitialState(targetPath) {
    try {
      const raw = fs.readFileSync(targetPath, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function persist() {
    ensureDirectory();
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  }

  function getState() {
    return structuredClone(state);
  }

  function replaceState(nextState) {
    state = normalizeState(nextState);
    persist();
    return getState();
  }

  function mutate(updater) {
    const nextState = updater(getState());
    return replaceState(nextState);
  }

  return {
    getState,
    replaceState,
    mutate,
  };
}

function normalizeState(value) {
  const alarms = Array.isArray(value?.alarms)
    ? value.alarms
        .map(normalizeAlarm)
        .filter(Boolean)
        .filter((alarm) => alarm.status !== "dismissed")
        .sort((a, b) => a.targetAt - b.targetAt)
    : [];

  const settings = {
    ...DEFAULT_STATE.settings,
    ...(value?.settings && typeof value.settings === "object" ? value.settings : {}),
  };

  settings.locale = normalizeLocale(settings.locale);
  settings.lastSoundSource = normalizeSoundSource(settings.lastSoundSource);

  return { alarms, settings };
}

function normalizeAlarm(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const targetAt = Number(value.targetAt);
  const createdAt = Number(value.createdAt);
  const updatedAt = Number(value.updatedAt ?? createdAt ?? Date.now());

  if (!Number.isFinite(targetAt) || !Number.isFinite(createdAt)) {
    return null;
  }

  return {
    id: String(value.id ?? ""),
    title: String(value.title ?? ""),
    notes: String(value.notes ?? ""),
    targetAt,
    repeat: normalizeStoredRepeat(value.repeat, targetAt),
    createdAt,
    updatedAt,
    soundEnabled: value.soundEnabled !== false,
    soundSource: normalizeSoundSource(value.soundSource),
    status: normalizeStatus(value.status),
    acknowledgedAt: Number.isFinite(Number(value.acknowledgedAt))
      ? Number(value.acknowledgedAt)
      : null,
  };
}

function normalizeStatus(value) {
  return value === "ringing" || value === "dismissed" ? value : "scheduled";
}

function normalizeLocale(value) {
  return value === "es" || value === "ca" || value === "en" || value === "ga" || value === "eu" || value === "system"
    ? value
    : "system";
}

function normalizeSoundSource(value) {
  return typeof value === "string" && value.startsWith("file://") ? value : null;
}
