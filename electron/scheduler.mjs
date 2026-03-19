export function createAlarmScheduler({ store, onStateChange, onRingStateChange }) {
  let tickTimer = null;
  let activeSoundAlarmIds = new Set();

  function start() {
    stop();
    evaluate();
    tickTimer = setInterval(() => evaluate(), 1000);
  }

  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    activeSoundAlarmIds = new Set();
    onRingStateChange(false);
  }

  function evaluate() {
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

  return {
    start,
    stop,
    evaluate,
  };
}
