import { useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, BellOff, Clock3, ExternalLink, Info, Plus, RefreshCw, Trash2 } from "lucide-react";
import "./App.css";
import type { Alarm, AlarmState } from "./types";

const ALARM_SOUND_PATH =
  "file:///home/jjdeharo/Documentos/github/escritorio-digital.github.io/dist/sounds/alarm-clock-elapsed.oga";

const fallbackState: AlarmState = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
  },
};

const APP_VERSION = __APP_VERSION__;
const APP_LICENSE = __APP_LICENSE__;
const APP_REPOSITORY = __APP_REPOSITORY__;
const LATEST_RELEASE_API = "https://api.github.com/repos/jjdeharo/puntual/releases/latest";

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date"; version: string }
  | { kind: "available"; version: string; url: string }
  | { kind: "error"; message: string };

function toInputDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function createDefaultComposer() {
  return {
    title: "",
    notes: "",
    targetAt: toInputDateTime(new Date()),
    countdownMinutes: "5",
    countdownSeconds: "0",
    soundEnabled: true,
  };
}

function formatTargetDate(timestamp: number) {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return `Hoy ${format(date, "HH:mm", { locale: es })}`;
  }

  if (isTomorrow(date)) {
    return `Mañana ${format(date, "HH:mm", { locale: es })}`;
  }

  return format(date, "d MMM, HH:mm", { locale: es });
}

function formatRemaining(timestamp: number, referenceNow: number) {
  const diff = timestamp - referenceNow;

  if (diff <= 0) {
    return "Ahora";
  }

  return formatDistanceStrict(timestamp, referenceNow, {
    locale: es,
    addSuffix: true,
  });
}

function compareVersions(left: string, right: string) {
  const normalize = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = normalize(left);
  const b = normalize(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

type ComposerState = {
  title: string;
  notes: string;
  targetAt: string;
  countdownMinutes: string;
  countdownSeconds: string;
  soundEnabled: boolean;
};

function App() {
  const [state, setState] = useState<AlarmState>(fallbackState);
  const [composer, setComposer] = useState<ComposerState>(createDefaultComposer);
  const [scheduleMode, setScheduleMode] = useState<"absolute" | "countdown">("countdown");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [ringing, setRinging] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    const audio = audioRef.current ?? new Audio(ALARM_SOUND_PATH);
    audioRef.current = audio;
    audio.loop = true;

    if (!ringing) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    void audio.play().catch(() => undefined);
  }, [ringing]);

  const scheduled = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "scheduled").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const ringingAlarms = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "ringing").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );

  const nextAlarm = scheduled[0] ?? null;
  const countdownDurationMs = useMemo(() => {
    const minutes = Number(composer.countdownMinutes || 0);
    const seconds = Number(composer.countdownSeconds || 0);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }
    const totalMs = Math.max(0, minutes) * 60_000 + Math.max(0, seconds) * 1_000;
    return totalMs > 0 ? totalMs : null;
  }, [composer.countdownMinutes, composer.countdownSeconds]);
  const previewTargetAt = useMemo(() => {
    if (scheduleMode === "countdown") {
      return countdownDurationMs ? now + countdownDurationMs : null;
    }
    const parsed = new Date(composer.targetAt).getTime();
    return Number.isFinite(parsed) && parsed > now ? parsed : null;
  }, [composer.targetAt, countdownDurationMs, now, scheduleMode]);
  const headerTargetAt = nextAlarm?.targetAt ?? previewTargetAt;
  const headerTargetLabel = nextAlarm
    ? formatTargetDate(nextAlarm.targetAt)
    : previewTargetAt
      ? `Vista previa: ${formatTargetDate(previewTargetAt)}`
      : "Sin próxima alarma";

  function resetComposer() {
    setComposer(createDefaultComposer());
    setScheduleMode("countdown");
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
      countdownMinutes: "5",
      countdownSeconds: "0",
      soundEnabled: alarm.soundEnabled,
    });
    setScheduleMode("absolute");
  }

  async function submitAlarm(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const targetAt =
      scheduleMode === "countdown"
        ? Date.now() + (countdownDurationMs ?? NaN)
        : new Date(composer.targetAt).getTime();
    if (!Number.isFinite(targetAt)) {
      setError(scheduleMode === "countdown" ? "Cuenta atrás inválida." : "Fecha inválida.");
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
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo guardar.");
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

  async function openExternal(url: string) {
    await window.alarmApi.openExternal(url);
  }

  async function checkForUpdates() {
    setUpdateStatus({ kind: "checking" });

    try {
      const response = await fetch(LATEST_RELEASE_API, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo consultar GitHub.");
      }

      const release = (await response.json()) as { tag_name?: string; html_url?: string };
      const latestVersion = String(release.tag_name ?? "").replace(/^v/i, "");

      if (!latestVersion) {
        throw new Error("GitHub no devolvió una versión válida.");
      }

      if (compareVersions(latestVersion, APP_VERSION) > 0) {
        setUpdateStatus({
          kind: "available",
          version: latestVersion,
          url: String(release.html_url ?? APP_REPOSITORY),
        });
        return;
      }

      setUpdateStatus({ kind: "up-to-date", version: latestVersion });
    } catch (caughtError) {
      setUpdateStatus({
        kind: "error",
        message: caughtError instanceof Error ? caughtError.message : "No se pudo comprobar.",
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Clock3 size={13} />
          </div>
          <div className="brand-copy">
            <strong>Puntual</strong>
            <span>{now ? format(new Date(now), "EEEE d MMMM, HH:mm", { locale: es }) : ""}</span>
          </div>
        </div>

        <div className="topbar-center">
          <div className="status-line">
            <span className={`state-chip ${ringing ? "alert" : ""}`}>{ringing ? "Sonando" : "En espera"}</span>
            <strong>{headerTargetAt ? formatRemaining(headerTargetAt, now) : "Sin alarmas"}</strong>
          </div>
          <span className="next-line">{headerTargetLabel}</span>
        </div>

        <label className="checkbox-inline prominent topbar-checkbox">
          <input
            type="checkbox"
            checked={state.settings.launchAtLogin}
            onChange={(event) => window.alarmApi.setLaunchAtLogin(event.target.checked)}
          />
          <span>Iniciar Puntual con el sistema</span>
        </label>

        <button type="button" className="secondary-button topbar-action" onClick={() => setAboutOpen(true)}>
          <Info size={13} />
          Acerca de
        </button>
      </header>

      <section className="main-grid">
        <form className="composer" onSubmit={submitAlarm}>
          <div className="section-head">
            <h1>{editingId ? "Editar alarma" : "Nueva alarma"}</h1>
          </div>

          <input
            value={composer.title}
            onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
            placeholder="Título"
          />

          <div className="mode-row">
            <button
              type="button"
              className={scheduleMode === "countdown" ? "toggle-button active" : "toggle-button"}
              onClick={() => setScheduleMode("countdown")}
            >
              Cuenta atrás
            </button>
            <button
              type="button"
              className={scheduleMode === "absolute" ? "toggle-button active" : "toggle-button"}
              onClick={() => setScheduleMode("absolute")}
            >
              Fecha y hora
            </button>
          </div>

          {scheduleMode === "countdown" ? (
            <div className="countdown-row">
              <input
                type="number"
                min="0"
                value={composer.countdownMinutes}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, countdownMinutes: event.target.value }))
                }
                placeholder="Min"
              />
              <input
                type="number"
                min="0"
                max="59"
                value={composer.countdownSeconds}
                onChange={(event) =>
                  setComposer((current) => ({ ...current, countdownSeconds: event.target.value }))
                }
                placeholder="Seg"
              />
            </div>
          ) : (
            <input
              type="datetime-local"
              value={composer.targetAt}
              onChange={(event) => setComposer((current) => ({ ...current, targetAt: event.target.value }))}
            />
          )}

          <div className="composer-row">
            <button
              type="button"
              className={composer.soundEnabled ? "toggle-button active" : "toggle-button"}
              onClick={() => setComposer((current) => ({ ...current, soundEnabled: !current.soundEnabled }))}
            >
              {composer.soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {composer.soundEnabled ? "Sonido" : "Silencio"}
            </button>
          </div>

          <textarea
            value={composer.notes}
            onChange={(event) => setComposer((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notas"
            rows={2}
          />

          {error ? <div className="error-banner">{error}</div> : null}

          {editingId ? (
            <button type="button" className="secondary-button full-width" onClick={resetComposer}>
              Cancelar
            </button>
          ) : null}

          <button type="submit" className="primary-button primary-submit">
            <Plus size={13} />
            {editingId ? "Guardar" : "Añadir"}
          </button>
        </form>

        <section className="lists">
          <div className="list-block">
            <div className="list-head">
              <h2>Alarmas activas</h2>
              <span>{scheduled.length}</span>
            </div>

            <div className="list-body">
              {scheduled.length === 0 ? (
                <div className="empty-state">Sin alarmas activas.</div>
              ) : (
                scheduled.map((alarm) => (
                  <article className="alarm-row" key={alarm.id}>
                    <div className="alarm-copy">
                      <strong title={alarm.notes || undefined}>{alarm.title || "Sin título"}</strong>
                      <span>{formatTargetDate(alarm.targetAt)}</span>
                      <small>{now ? formatRemaining(alarm.targetAt, now) : ""}</small>
                    </div>

                    <div className="alarm-actions">
                      <span className={alarm.soundEnabled ? "sound-pill active" : "sound-pill"}>
                        {alarm.soundEnabled ? "Sonido" : "Muda"}
                      </span>
                      <button type="button" className="secondary-button" onClick={() => startEditing(alarm)}>
                        Editar
                      </button>
                      <button type="button" className="icon-button" onClick={() => deleteAlarm(alarm.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="list-block">
            <div className="list-head">
              <h2>Sonando</h2>
              <span>{ringingAlarms.length}</span>
            </div>

            <div className="list-body small">
              {ringingAlarms.length === 0 ? (
                <div className="empty-state">Nada activo.</div>
              ) : (
                ringingAlarms.map((alarm) => (
                  <article className="alarm-row alert" key={alarm.id}>
                    <div className="alarm-copy">
                      <strong>{alarm.title || "Sin título"}</strong>
                      <span>{formatTargetDate(alarm.targetAt)}</span>
                    </div>

                    <button type="button" className="primary-button" onClick={() => dismissAlarm(alarm.id)}>
                      Descartar
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </section>

      {aboutOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <section
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h2 id="about-title">Acerca de Puntual</h2>
              <button type="button" className="icon-button" onClick={() => setAboutOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <p className="about-copy">
              Alarma de escritorio con bandeja, persistencia real y cuenta atrás que sobrevive a cierres y reinicios.
            </p>

            <dl className="about-meta">
              <div>
                <dt>Versión</dt>
                <dd>{APP_VERSION}</dd>
              </div>
              <div>
                <dt>Licencia</dt>
                <dd>{APP_LICENSE}</dd>
              </div>
              <div>
                <dt>Repositorio</dt>
                <dd>{APP_REPOSITORY.replace(/^https?:\/\//, "")}</dd>
              </div>
            </dl>

            <div className="about-actions">
              <button type="button" className="secondary-button" onClick={() => openExternal(APP_REPOSITORY)}>
                <ExternalLink size={13} />
                Abrir repo
              </button>
              <button type="button" className="secondary-button" onClick={() => openExternal(`${APP_REPOSITORY}/releases/latest`)}>
                <ExternalLink size={13} />
                Descargas
              </button>
              <button type="button" className="secondary-button" onClick={checkForUpdates}>
                <RefreshCw size={13} className={updateStatus.kind === "checking" ? "spin" : ""} />
                Buscar actualizaciones
              </button>
            </div>

            <div className="update-status" aria-live="polite">
              {updateStatus.kind === "checking" ? <span>Consultando la última release publicada...</span> : null}
              {updateStatus.kind === "up-to-date" ? <span>Estás al día. Última versión publicada: {updateStatus.version}.</span> : null}
              {updateStatus.kind === "available" ? (
                <span>
                  Hay una versión más reciente: {updateStatus.version}.{" "}
                  <button type="button" className="inline-link" onClick={() => openExternal(updateStatus.url)}>
                    Abrir release
                  </button>
                </span>
              ) : null}
              {updateStatus.kind === "error" ? <span>{updateStatus.message}</span> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
