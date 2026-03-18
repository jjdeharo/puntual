import { fileURLToPath } from "node:url";
import { Notification, app } from "electron";
import { advanceAlarm } from "./recurrence.mjs";

const notificationIconPath = fileURLToPath(new URL("./notification-icon.png", import.meta.url));

function normalizeLocale(value) {
  const base = String(value ?? "").toLowerCase().split("-")[0];
  return base === "ca" || base === "en" || base === "ga" || base === "eu" ? base : "es";
}

function getLocale(state) {
  return state?.settings?.locale === "system" ? normalizeLocale(app.getLocale()) : normalizeLocale(state?.settings?.locale);
}

function t(state, key) {
  const locale = getLocale(state);
  const dictionaries = {
    es: {
      untitled: "Alarma sin título",
      pending: "Alarma pendiente al volver a iniciar",
      active: "Alarma activada",
      click_to_stop: "Haz clic para detener.",
    },
    ca: {
      untitled: "Alarma sense títol",
      pending: "Alarma pendent en tornar a iniciar",
      active: "Alarma activada",
      click_to_stop: "Fes clic per aturar-la.",
    },
    ga: {
      untitled: "Alarma sen título",
      pending: "Alarma pendente ao volver iniciar",
      active: "Alarma activada",
      click_to_stop: "Fai clic para detela.",
    },
    eu: {
      untitled: "Izenbururik gabeko alarma",
      pending: "Berriro irekitzean zain dagoen alarma",
      active: "Alarma aktibatuta",
      click_to_stop: "Egin klik gelditzeko.",
    },
    en: {
      untitled: "Untitled alarm",
      pending: "Pending alarm after reopening",
      active: "Alarm triggered",
      click_to_stop: "Click to stop it.",
    },
  };

  return dictionaries[locale][key] ?? dictionaries.es[key];
}

function ringMessage(alarm, state) {
  return alarm.title?.trim() ? alarm.title.trim() : t(state, "untitled");
}

export function createAlarmScheduler({ store, onStateChange, onRingStateChange }) {
  let tickTimer = null;
  let activeSoundAlarmIds = new Set();

  function start() {
    stop();
    evaluate(true);
    tickTimer = setInterval(() => evaluate(false), 1000);
  }

  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    activeSoundAlarmIds = new Set();
    onRingStateChange(false);
  }

  function evaluate(notifyRecovered) {
    let triggeredNow = [];
    const currentState = store.getState();
    const now = Date.now();
    const alarms = currentState.alarms.map((alarm) => {
      if (alarm.status !== "scheduled") {
        return alarm;
      }
      if (alarm.targetAt > now) {
        return alarm;
      }
      const ringing = {
        ...alarm,
        status: "ringing",
        updatedAt: now,
      };
      triggeredNow.push(ringing);
      return ringing;
    });

    const nextState =
      triggeredNow.length > 0
        ? store.replaceState({
            ...currentState,
            alarms,
          })
        : currentState;

    updateBeepLoop(nextState);
    if (triggeredNow.length > 0) {
      onStateChange(nextState);
    }

    if (triggeredNow.length > 0) {
      for (const alarm of triggeredNow) {
        showNotification(alarm, nextState, notifyRecovered);
      }
    }
  }

  function dismissAlarmById(id) {
    const now = Date.now();
    const nextState = store.mutate((current) => ({
      ...current,
      alarms: current.alarms.map((alarm) => (alarm.id === id ? advanceAlarm(alarm, now) : alarm)),
    }));

    updateBeepLoop(nextState);
    onStateChange(nextState);
  }

  function updateBeepLoop(state) {
    const nextIds = new Set(
      state.alarms
        .filter((alarm) => alarm.status === "ringing" && alarm.soundEnabled)
        .map((alarm) => alarm.id)
    );

    activeSoundAlarmIds = nextIds;
    onRingStateChange(nextIds.size > 0);

    if (nextIds.size === 0) {
      activeSoundAlarmIds = new Set();
      onRingStateChange(false);
      return;
    }
  }

  function showNotification(alarm, state, recovered) {
    const notification = new Notification({
      title: recovered ? t(state, "pending") : t(state, "active"),
      body: `${ringMessage(alarm, state)}. ${t(state, "click_to_stop")}`,
      icon: notificationIconPath,
      urgency: "critical",
      // The renderer is responsible for alarm audio so the system notification stays silent.
      silent: true,
    });

    notification.on("click", () => {
      dismissAlarmById(alarm.id);
    });

    notification.show();
  }

  return {
    start,
    stop,
    evaluate,
  };
}
