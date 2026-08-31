import React from "react";
import { useSettings } from "../settings.jsx";
import { useOverlay } from "../useOverlay.js";
import {
  THEMES, ODDS_FORMATS, UI_SCALE, SAMPLE_WINDOWS, LEANS, SPORT_OPTIONS, TIME_ZONES,
} from "../SettingsSections.jsx";
import { Segmented, SelectRow, ToggleRow, Field, MONO, DISPLAY } from "./settingsFields.jsx";

// The quick-settings popover.
//
// No v3 mock draws one — Alex asked for it kept alongside the full screen:
// "i still want the settings pop up and then the full settings page". So this
// is built *in* the v3 vocabulary rather than styled to resemble it: every
// control is the same `Field` / `Segmented` / `SelectRow` / `ToggleRow` the
// frames use, from `settingsFields.jsx`, reading and writing the same store.
//
// That is what makes it match rather than approximate. A theme changed here is
// the same value the settings screen shows, drawn by the same component, and
// neither can drift into a second answer.
//
// It is deliberately a *subset*: the settings that get changed mid-session,
// with everything else a click away. Anything needing room — the accent ring,
// the outcome-colour pairs, bankroll, Account, About — lives on the screen,
// and ALL SETTINGS goes there.

const QUICK = { display: ["theme", "reduceMotion", "oddsFormat", "uiScale", "timeZone"], betting: ["defaultSport", "sampleWindow", "lean"] };

export default function SettingsPopover({ open, onClose, isNarrow, onOpenFullSettings }) {
  const settings = useSettings();
  const [tab, setTab] = React.useState("display");
  const { panelRef, requestClose } = useOverlay({ open, onClose, historyKey: "settingsPopover" });

  if (!open) return null;

  const d = settings.display;
  const b = settings.betting;
  const setD = (k, v) => settings.set("display", k, v);
  const setB = (k, v) => settings.set("betting", k, v);
  const opts = (list) => list.map((o) => ({ id: o.id ?? o.value ?? o, label: o.label ?? String(o) }));

  // A right-edge panel on desktop, the bottom sheet every overlay in this app
  // uses at 430px. The frames' own sheets sit the same way.
  const placement = isNarrow
    ? {
        left: 0, right: 0, bottom: 0, maxHeight: "88vh",
        borderRadius: "16px 16px 0 0",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
      }
    : { top: 0, right: 0, bottom: 0, width: 380, borderLeft: "1px solid var(--line)" };

  const tabStyle = (on) => ({
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 13px",
    borderRadius: 7, fontFamily: MONO, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  });

  return (
    <>
      <div
        onClick={requestClose}
        style={{
          position: "fixed", inset: 0, zIndex: 3400,
          background: "rgba(5,6,8,0.62)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "fixed", zIndex: 3401,
          background: "var(--bg)",
          border: isNarrow ? "1px solid var(--line)" : "none",
          display: "flex", flexDirection: "column",
          overflow: "hidden", outline: "none",
          ...placement,
        }}
      >
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18 }}>Settings</span>
          <span
            role="button"
            tabIndex={0}
            onClick={requestClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); } }}
            aria-label="Close settings"
            style={{ marginLeft: "auto", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--text-2)", fontSize: 15, cursor: "pointer" }}
          >
            ×
          </span>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", gap: 7, padding: "12px 18px" }}>
          {[["display", "Display"], ["betting", "Betting"]].map(([id, label]) => (
            <div
              key={id}
              role="tab"
              aria-selected={tab === id}
              tabIndex={0}
              onClick={() => setTab(id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(id); } }}
              style={tabStyle(tab === id)}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "4px 18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {tab === "display" && (
            <>
              <Field label="Theme" hint="Auto follows your device's light/dark setting as it changes.">
                <Segmented options={opts(THEMES)} value={d.theme} onChange={(v) => setD("theme", v)} ariaLabel="Theme" />
              </Field>
              <Field label="Motion" hint="Starts from your device setting.">
                <ToggleRow checked={d.reduceMotion} onChange={(v) => setD("reduceMotion", v)} label="Reduce motion" />
              </Field>
              <Field label="Odds format" hint="Applied everywhere odds appear.">
                <Segmented options={opts(ODDS_FORMATS)} value={d.oddsFormat} onChange={(v) => setD("oddsFormat", v)} ariaLabel="Odds format" />
              </Field>
              <Field label="Display size" hint="Scales the whole interface, not just text.">
                <Segmented options={opts(UI_SCALE)} value={d.uiScale} onChange={(v) => setD("uiScale", v)} ariaLabel="Display size" />
              </Field>
              <Field label="Time zone" hint="Game times are shown in this zone.">
                <SelectRow options={opts(TIME_ZONES)} value={d.timeZone} onChange={(v) => setD("timeZone", v)} ariaLabel="Time zone" />
              </Field>
            </>
          )}

          {tab === "betting" && (
            <>
              <Field label="Default sport" hint="Which board the app opens on. Auto picks whatever is in season.">
                <SelectRow options={opts(SPORT_OPTIONS)} value={b.defaultSport} onChange={(v) => setB("defaultSport", v)} ariaLabel="Default sport" />
              </Field>
              <Field label="Default sample size" hint="Which hit-rate window the Prop Feed opens on.">
                <Segmented options={opts(SAMPLE_WINDOWS)} value={b.sampleWindow} onChange={(v) => setB("sampleWindow", v)} ariaLabel="Default sample size" />
              </Field>
              <Field label="Default side" hint="Which side of the line the feed is priced from when it loads.">
                <Segmented options={opts(LEANS)} value={b.lean} onChange={(v) => setB("lean", v)} ariaLabel="Default side" />
              </Field>
            </>
          )}

          {/* What is not here, and where it is. Naming the four keeps this a
              deliberate subset rather than a shorter list of everything. */}
          <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--dim)" }}>
            {tab === "display"
              ? "The accent ring and the outcome-colour pairs need more room — they are on the full screen."
              : "Bankroll, unit size and your default sportsbook are on the full screen."}
          </span>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: "1px solid var(--line)" }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", lineHeight: 1.6, color: "var(--dim)" }}>
            Stored in this browser only.
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={() => { requestClose(); onOpenFullSettings && onOpenFullSettings(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); onOpenFullSettings && onOpenFullSettings(); } }}
            style={{ marginLeft: "auto", minHeight: 34, display: "flex", alignItems: "center", padding: "0 13px", borderRadius: 8, border: "1px solid var(--amber)", background: "var(--amber-dim)", color: "var(--amber-ink)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ALL SETTINGS →
          </span>
        </div>
      </div>
    </>
  );
}
