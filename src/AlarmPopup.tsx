import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, Grip, X } from "lucide-react";
import type { Alarm, AlarmState, AppLocale, SnoozeDurationInput } from "./types";
import "./AlarmPopup.css";

const FALLBACK_STATE: AlarmState = {
  alarms: [],
  settings: {
    launchAtLogin: true,
    silenceWhileWindowOpen: false,
    locale: "system",
    lastSoundSource: null,
    alarmPopupPosition: null,
  },
};

const MESSAGES = {
  es: {
    subtitle_one: "1 alarma",
    subtitle_other: "{count} alarmas",
    dismiss: "Descartar",
    dismissAll: "Descartar todo",
    snooze: "Posponer",
    daysShortLabel: "Días",
    hoursShortLabel: "Horas",
    minutesShortLabel: "Min",
    apply: "Aplicar",
    cancel: "Cancelar",
    dismissTitle: "Descartar alarma",
    untitled: "Alarma sin título",
    at: "Programada a las {time}",
    showList: "Ver alarmas",
    hideList: "Ocultar alarmas",
  },
  ca: {
    subtitle_one: "1 alarma",
    subtitle_other: "{count} alarmes",
    dismiss: "Descarta",
    dismissAll: "Descarta-ho tot",
    snooze: "Posposa",
    daysShortLabel: "Dies",
    hoursShortLabel: "Hores",
    minutesShortLabel: "Min",
    apply: "Aplica",
    cancel: "Cancel·la",
    dismissTitle: "Descarta alarma",
    untitled: "Alarma sense títol",
    at: "Programada a les {time}",
    showList: "Mostra alarmes",
    hideList: "Amaga alarmes",
  },
  ga: {
    subtitle_one: "1 alarma",
    subtitle_other: "{count} alarmas",
    dismiss: "Descartar",
    dismissAll: "Descartar todo",
    snooze: "Pospoñer",
    daysShortLabel: "Días",
    hoursShortLabel: "Horas",
    minutesShortLabel: "Min",
    apply: "Aplicar",
    cancel: "Cancelar",
    dismissTitle: "Descartar alarma",
    untitled: "Alarma sen título",
    at: "Programada ás {time}",
    showList: "Ver alarmas",
    hideList: "Agochar alarmas",
  },
  eu: {
    subtitle_one: "Alarma 1",
    subtitle_other: "{count} alarma",
    dismiss: "Baztertu",
    dismissAll: "Denak baztertu",
    snooze: "Atzeratu",
    daysShortLabel: "Egun",
    hoursShortLabel: "Ordu",
    minutesShortLabel: "Min",
    apply: "Aplikatu",
    cancel: "Utzi",
    dismissTitle: "Alarma baztertu",
    untitled: "Izenbururik gabeko alarma",
    at: "{time}-rako programatua",
    showList: "Alarmak erakutsi",
    hideList: "Alarmak ezkutatu",
  },
  en: {
    subtitle_one: "1 alarm",
    subtitle_other: "{count} alarms",
    dismiss: "Dismiss",
    dismissAll: "Dismiss all",
    snooze: "Snooze",
    daysShortLabel: "Days",
    hoursShortLabel: "Hours",
    minutesShortLabel: "Min",
    apply: "Apply",
    cancel: "Cancel",
    dismissTitle: "Dismiss alarm",
    untitled: "Untitled alarm",
    at: "Scheduled for {time}",
    showList: "Show alarms",
    hideList: "Hide alarms",
  },
} as const;

function normalizeLocale(value: string | null | undefined): Exclude<AppLocale, "system"> {
  const base = String(value ?? "").toLowerCase().split("-")[0];
  return base === "ca" || base === "en" || base === "ga" || base === "eu" ? base : "es";
}

function translate(
  locale: Exclude<AppLocale, "system">,
  key: keyof (typeof MESSAGES)["es"],
  variables: Record<string, string | number> = {}
) {
  return (MESSAGES[locale][key] ?? MESSAGES.es[key]).replace(/\{(\w+)\}/g, (_match, token) => String(variables[token] ?? ""));
}

function formatAlarmTime(alarm: Alarm, locale: Exclude<AppLocale, "system">) {
  const target = new Date(alarm.baseTargetAt ?? alarm.targetAt);
  const sameDay = target.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(target);
}

type SnoozeDraft = {
  days: string;
  hours: string;
  minutes: string;
};

function createDefaultSnoozeDraft(): SnoozeDraft {
  return {
    days: "0",
    hours: "0",
    minutes: "5",
  };
}

function clampSnoozeField(value: string, max: number) {
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) {
    return "0";
  }
  return String(Math.min(max, Number.parseInt(digits, 10) || 0));
}

function parseSnoozeDraft(draft: SnoozeDraft): SnoozeDurationInput | null {
  const days = Number.parseInt(draft.days, 10) || 0;
  const hours = Number.parseInt(draft.hours, 10) || 0;
  const minutes = Number.parseInt(draft.minutes, 10) || 0;
  return days > 0 || hours > 0 || minutes > 0 ? { days, hours, minutes } : null;
}

export default function AlarmPopup() {
  const [state, setState] = useState<AlarmState>(FALLBACK_STATE);
  const [expanded, setExpanded] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDraft, setSnoozeDraft] = useState<SnoozeDraft>(() => createDefaultSnoozeDraft());

  useEffect(() => {
    let mounted = true;

    window.alarmApi.getState().then((nextState) => {
      if (mounted) {
        setState(nextState);
        if (nextState.alarms.filter((alarm) => alarm.status === "ringing").length <= 1) {
          setExpanded(false);
        }
        if (nextState.alarms.filter((alarm) => alarm.status === "ringing").length === 0) {
          setSnoozeOpen(false);
        }
      }
    });

    const unsubscribe = window.alarmApi.onState((nextState) => {
      setState(nextState);
      if (nextState.alarms.filter((alarm) => alarm.status === "ringing").length <= 1) {
        setExpanded(false);
      }
      if (nextState.alarms.filter((alarm) => alarm.status === "ringing").length === 0) {
        setSnoozeOpen(false);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const locale = useMemo(
    () => normalizeLocale(state.settings.locale === "system" ? navigator.language : state.settings.locale),
    [state.settings.locale]
  );
  const ringingAlarms = useMemo(
    () => state.alarms.filter((alarm) => alarm.status === "ringing").sort((a, b) => a.targetAt - b.targetAt),
    [state.alarms]
  );
  const subtitle =
    ringingAlarms.length === 1
      ? translate(locale, "subtitle_one")
      : translate(locale, "subtitle_other", { count: ringingAlarms.length });
  const primaryAlarm = ringingAlarms[0] ?? null;
  const isExpanded = ringingAlarms.length > 1 && expanded;

  async function toggleExpanded() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    await window.alarmApi.setAlarmPopupExpanded(nextExpanded);
  }

  async function submitSnooze() {
    const duration = parseSnoozeDraft(snoozeDraft);
    if (!duration) {
      return;
    }
    setSnoozeOpen(false);
    setSnoozeDraft(createDefaultSnoozeDraft());
    await window.alarmApi.snoozeRinging(duration);
  }

  if (ringingAlarms.length === 0) {
    return <div className="alarm-popup-shell is-empty" />;
  }

  return (
    <main className="alarm-popup-shell">
      <section className="alarm-popup-card">
        <div className="alarm-popup-dragbar" aria-hidden="true">
          <Grip size={14} className="alarm-popup-dragicon" />
          <span className="alarm-popup-draglabel">Arrastrar</span>
        </div>

        {ringingAlarms.length === 1 && primaryAlarm ? (
          <section className="alarm-popup-single">
            <div className="alarm-popup-single-copy">
              <strong>{primaryAlarm.title.trim() || translate(locale, "untitled")}</strong>
              <span>
                <Clock3 size={14} />
                {translate(locale, "at", { time: formatAlarmTime(primaryAlarm, locale) })}
              </span>
            </div>
          </section>
        ) : (
          <section className="alarm-popup-multi">
            <button type="button" className="alarm-popup-toggle" onClick={() => void toggleExpanded()}>
              <span>
                {subtitle} · {isExpanded ? translate(locale, "hideList") : translate(locale, "showList")}
              </span>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isExpanded ? (
              <div className="alarm-popup-list" role="list" aria-label={subtitle}>
                {ringingAlarms.map((alarm) => (
                  <article key={alarm.id} className="alarm-popup-item" role="listitem">
                    <div className="alarm-popup-item-copy">
                      <strong>{alarm.title.trim() || translate(locale, "untitled")}</strong>
                      <span>
                        <Clock3 size={13} />
                        {translate(locale, "at", { time: formatAlarmTime(alarm, locale) })}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="alarm-popup-dismiss"
                      aria-label={translate(locale, "dismissTitle")}
                      title={translate(locale, "dismissTitle")}
                      onClick={() => window.alarmApi.dismissAlarm(alarm.id)}
                    >
                      <X size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="alarm-popup-collapsed-list">
                {ringingAlarms.slice(0, 2).map((alarm) => (
                  <div key={alarm.id} className="alarm-popup-collapsed-item">
                    <strong>{alarm.title.trim() || translate(locale, "untitled")}</strong>
                    <span>{formatAlarmTime(alarm, locale)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="alarm-popup-footer">
          <div className="alarm-popup-snooze">
            <button
              type="button"
              className="alarm-popup-snooze-trigger"
              onClick={() => {
                setSnoozeDraft(createDefaultSnoozeDraft());
                setSnoozeOpen(true);
              }}
            >
              {translate(locale, "snooze")}
            </button>
          </div>
          {ringingAlarms.length === 1 && primaryAlarm ? (
            <button type="button" className="alarm-popup-dismiss-main" onClick={() => window.alarmApi.dismissAlarm(primaryAlarm.id)}>
              {translate(locale, "dismiss")}
            </button>
          ) : (
            <button type="button" className="alarm-popup-dismiss-main" onClick={() => window.alarmApi.dismissAllRinging()}>
              {translate(locale, "dismissAll")}
            </button>
          )}
        </footer>

        {snoozeOpen ? (
          <div className="alarm-popup-overlay" onClick={() => setSnoozeOpen(false)}>
            <section className="alarm-popup-overlay-card" onClick={(event) => event.stopPropagation()}>
              <div className="alarm-popup-overlay-grid">
                <label className="alarm-popup-overlay-field">
                  <span>{translate(locale, "daysShortLabel")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={snoozeDraft.days}
                    onChange={(event) => setSnoozeDraft((current) => ({ ...current, days: clampSnoozeField(event.target.value, 999) }))}
                  />
                </label>
                <label className="alarm-popup-overlay-field">
                  <span>{translate(locale, "hoursShortLabel")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={snoozeDraft.hours}
                    onChange={(event) => setSnoozeDraft((current) => ({ ...current, hours: clampSnoozeField(event.target.value, 23) }))}
                  />
                </label>
                <label className="alarm-popup-overlay-field">
                  <span>{translate(locale, "minutesShortLabel")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={snoozeDraft.minutes}
                    onChange={(event) => setSnoozeDraft((current) => ({ ...current, minutes: clampSnoozeField(event.target.value, 59) }))}
                  />
                </label>
              </div>
              <div className="alarm-popup-overlay-actions">
                <button type="button" className="alarm-popup-chip ghost" onClick={() => setSnoozeOpen(false)}>
                  {translate(locale, "cancel")}
                </button>
                <button type="button" className="alarm-popup-dismiss-main" onClick={() => void submitSnooze()}>
                  {translate(locale, "apply")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
