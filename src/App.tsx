import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { AlarmClockCheck, Bell, BellOff, Plus, Power, Trash2 } from "lucide-react";
import "./App.css";
import type { Alarm, AlarmState } from "./types";

const fallbackState: AlarmState = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
  },
};

function toInputDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatTargetDate(timestamp: number) {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return `Hoy, ${format(date, "HH:mm", { locale: es })}`;
  }

  if (isTomorrow(date)) {
    return `Mañana, ${format(date, "HH:mm", { locale: es })}`;
  }

  return format(date, "EEE d MMM, HH:mm", { locale: es });
}

function formatRemaining(timestamp: number, referenceNow: number) {
  const diff = timestamp - referenceNow;

  if (diff <= 0) {
    return "Ahora mismo";
  }

  return formatDistanceStrict(timestamp, referenceNow, {
    locale: es,
    addSuffix: true,
  });
}

type ComposerState = {
  title: string;
  notes: string;
  targetAt: string;
  soundEnabled: boolean;
};

function App() {
  const [state, setState] = useState<AlarmState>(fallbackState);
  const [composer, setComposer] = useState<ComposerState>({
    title: "",
    notes: "",
    targetAt: "",
    soundEnabled: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [ringing, setRinging] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    window.alarmApi.getState().then((nextState) => {
      if (!mounted) {
        return;
      }
      setState(nextState);
      setRinging(nextState.alarms.some((alarm) => alarm.status === "ringing" && alarm.soundEnabled));
    });

    const unsubscribeState = window.alarmApi.onState((nextState) => {
      setState(nextState);
      setRinging(nextState.alarms.some((alarm) => alarm.status === "ringing" && alarm.soundEnabled));
    });
    const unsubscribeRing = window.alarmApi.onRingState((nextRinging) => setRinging(nextRinging));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeRing();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    async function playPulse() {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }

      const context = audioContextRef.current ?? new AudioCtx();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        await context.resume();
      }

      const startAt = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.24);
    }

    if (!ringing) {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      return;
    }

    void playPulse();
    alarmIntervalRef.current = window.setInterval(() => {
      void playPulse();
    }, 1400);

    return () => {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, [ringing]);

  const scheduled = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "scheduled").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const ringingAlarms = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "ringing").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const dismissed = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "dismissed").sort((a, b) => b.updatedAt - a.updatedAt),
    [state.alarms]
  );

  const nextAlarm = scheduled[0] ?? null;
  const totalWithSound = scheduled.filter((alarm) => alarm.soundEnabled).length;

  function resetComposer() {
    setComposer({
      title: "",
      notes: "",
      targetAt: "",
      soundEnabled: true,
    });
    setEditingId(null);
    setError("");
  }

  function startEditing(alarm: Alarm) {
    setEditingId(alarm.id);
    setError("");
    setComposer({
      title: alarm.title,
      notes: alarm.notes,
      targetAt: toInputDateTime(new Date(alarm.targetAt)),
      soundEnabled: alarm.soundEnabled,
    });
  }

  async function submitAlarm(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const targetAt = new Date(composer.targetAt).getTime();
    if (!Number.isFinite(targetAt)) {
      setError("La fecha y la hora no son válidas.");
      return;
    }

    const payload = {
      title: composer.title.trim(),
      notes: composer.notes.trim(),
      targetAt,
      soundEnabled: composer.soundEnabled,
    };

    try {
      if (editingId) {
        await window.alarmApi.updateAlarm({ ...payload, id: editingId });
      } else {
        await window.alarmApi.createAlarm(payload);
      }
      resetComposer();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo guardar la alarma.");
    }
  }

  async function dismissAlarm(id: string) {
    await window.alarmApi.dismissAlarm(id);
  }

  async function deleteAlarm(id: string) {
    await window.alarmApi.deleteAlarm(id);
    if (editingId === id) {
      resetComposer();
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div className="topbar-copy">
          <span className="eyebrow">Puntual</span>
          <h1>Recordatorios directos y persistentes</h1>
          <p>Ventana compacta, bandeja visible y avisos claros.</p>
        </div>

        <div className="topbar-meta">
          <div className="mini-stat">
            <span>Próxima</span>
            <strong>{nextAlarm ? formatTargetDate(nextAlarm.targetAt) : "Sin programar"}</strong>
          </div>
          <div className={`mini-stat ${ringing ? "alert" : ""}`}>
            <span>Estado</span>
            <strong>{ringing ? "Sonando" : "En espera"}</strong>
          </div>
        </div>
      </header>

      <section className="overview-grid">
        <article className="overview-card">
          <span>Activas</span>
          <strong>{scheduled.length}</strong>
          <p>{totalWithSound} con sonido</p>
        </article>

        <article className="overview-card">
          <span>Siguiente</span>
          <strong>{nextAlarm ? (now > 0 ? formatRemaining(nextAlarm.targetAt, now) : "Calculando...") : "Sin alarmas"}</strong>
          <p>{nextAlarm ? formatTargetDate(nextAlarm.targetAt) : "Programa una alarma nueva."}</p>
        </article>

        <article className="overview-card">
          <span>En curso</span>
          <strong>{ringingAlarms.length}</strong>
          <p>{ringingAlarms.length > 0 ? "Requieren descarte" : "Nada activo ahora"}</p>
        </article>
      </section>

      <section className="content-grid">
        <form className="composer-card panel" onSubmit={submitAlarm}>
          <div className="panel-header">
            <div>
              <span className="panel-kicker">{editingId ? "Editar" : "Nueva"}</span>
              <h2>{editingId ? "Actualizar alarma" : "Crear alarma"}</h2>
            </div>
            <button type="submit" className="primary-button">
              <Plus size={14} />
              {editingId ? "Guardar" : "Añadir"}
            </button>
          </div>

          <label className="field">
            <span>Título</span>
            <input
              value={composer.title}
              onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
              placeholder="Clase, descanso, reunión..."
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Fecha y hora</span>
              <input
                type="datetime-local"
                value={composer.targetAt}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, targetAt: event.target.value }))
                }
              />
            </label>

            <label className="toggle-card">
              <span>Sonido</span>
              <button
                type="button"
                className={composer.soundEnabled ? "toggle-button active" : "toggle-button"}
                onClick={() =>
                  setComposer((current) => ({ ...current, soundEnabled: !current.soundEnabled }))
                }
              >
                {composer.soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                {composer.soundEnabled ? "Activo" : "Mudo"}
              </button>
            </label>
          </div>

          <label className="field">
            <span>Notas</span>
            <textarea
              value={composer.notes}
              onChange={(event) => setComposer((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Opcional"
              rows={3}
            />
          </label>

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="composer-footer">
            <label className="setting-inline">
              <input
                type="checkbox"
                checked={state.settings.launchAtLogin}
                onChange={(event) => window.alarmApi.setLaunchAtLogin(event.target.checked)}
              />
              <span>Iniciar con la sesión</span>
            </label>

            {editingId ? (
              <button type="button" className="ghost-button" onClick={resetComposer}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="stack-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Programadas</span>
                <h2>Alarmas activas</h2>
              </div>
            </div>

            <div className="alarm-list">
              {scheduled.length === 0 ? (
                <div className="empty-state">
                  <AlarmClockCheck size={22} />
                  <p>No hay alarmas activas.</p>
                </div>
              ) : (
                scheduled.map((alarm) => (
                  <article className="alarm-card" key={alarm.id}>
                    <div className="alarm-card-copy">
                      <strong>{alarm.title || "Alarma sin título"}</strong>
                      <span>{formatTargetDate(alarm.targetAt)}</span>
                      <p>{alarm.notes || (now > 0 ? formatRemaining(alarm.targetAt, now) : "Calculando...")}</p>
                    </div>

                    <div className="alarm-card-meta">
                      <span className={alarm.soundEnabled ? "pill active" : "pill"}>
                        {alarm.soundEnabled ? "Con sonido" : "Silenciosa"}
                      </span>
                      <div className="alarm-card-actions">
                        <button type="button" className="ghost-button" onClick={() => startEditing(alarm)}>
                          Editar
                        </button>
                        <button type="button" className="icon-button" onClick={() => deleteAlarm(alarm.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Avisos</span>
                <h2>Sonando</h2>
              </div>
            </div>

            <div className="alarm-list compact">
              {ringingAlarms.length === 0 ? (
                <div className="empty-state muted">
                  <Power size={18} />
                  <p>Sin alarmas sonando.</p>
                </div>
              ) : (
                ringingAlarms.map((alarm) => (
                  <article className="alarm-card ringing" key={alarm.id}>
                    <div className="alarm-card-copy">
                      <strong>{alarm.title || "Alarma sin título"}</strong>
                      <span>Programada para {formatTargetDate(alarm.targetAt)}</span>
                      <p>{alarm.notes || "La alarma sigue activa hasta descartarla."}</p>
                    </div>

                    <div className="alarm-card-actions">
                      <button type="button" className="primary-button soft" onClick={() => dismissAlarm(alarm.id)}>
                        Descartar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel panel-history">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Historial</span>
                <h2>Últimas descartadas</h2>
              </div>
            </div>

            <div className="history-list">
              {dismissed.slice(0, 6).map((alarm) => (
                <div className="history-row" key={alarm.id}>
                  <span>{alarm.title || "Alarma sin título"}</span>
                  <small>{formatTargetDate(alarm.targetAt)}</small>
                </div>
              ))}
              {dismissed.length === 0 ? <div className="empty-inline">Todavía no hay historial.</div> : null}
            </div>
          </section>
        </div>
      </section>

      <footer className="status-bar">
        <span>{ringing ? "Hay alarmas activas en este momento." : "La app sigue viva al cerrar la ventana."}</span>
        <span>{now ? format(new Date(now), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : ""}</span>
      </footer>
    </main>
  );
}

export default App;
