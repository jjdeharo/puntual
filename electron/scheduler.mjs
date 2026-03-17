import { Notification } from "electron";

function ringMessage(alarm) {
  return alarm.title?.trim() ? alarm.title.trim() : "Alarma sin título";
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
        showNotification(alarm, notifyRecovered);
      }
    }
  }

  function dismissAlarmById(id) {
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

  function showNotification(alarm, recovered) {
    const notification = new Notification({
      title: recovered ? "Alarma pendiente al volver a iniciar" : "Alarma activada",
      body: `${ringMessage(alarm)}. Haz clic para detener.`,
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
