import React from "react";
import { useSettings } from "./settings.jsx";
import { useOverlay } from "./useOverlay.js";
import { ACCENT_PRESETS } from "./ColorWheel.jsx";
import {
  Field, Segmented, Toggle,
  THEMES, ODDS_FORMATS, SAMPLE_WINDOWS, LEANS, SPORT_OPTIONS, UI_SCALE, TIME_ZONES,
} from "./SettingsSections.jsx";

// --------------------------------------------------------------------------
// The cog's quick panel
// --------------------------------------------------------------------------
// Transcribed from the slide-over `PropPalace Prop Feed v2.dc.html` draws at
// the end of its markup, guarded by `<sc-if value="{{ settingsOpen }}">` --
// not a separate file, which is why it belongs to that screen.
//
// It used to be the whole of Settings: four sections, both colour wheels, the
// glossary, the tutorial, all in one 940x660 dialog opened from every screen.
// The full set is a page now (SettingsPage.jsx); this is the panel beside it.
//
// The file's own contents, in its own order: two tabs, then Theme, Reduce
// motion, Accent colour, Odds format, Display size, Time zone on Display, and
// Default sport, Default sample size, Default side on Betting. The controls
// are the shared ones from SettingsSections.jsx -- the same components the
// page renders, so a setting cannot look like one thing here and another
// there. What is *not* here is the deep material: the exact-colour wheels, the
// outcome pairs, bankroll and units, the glossary, the resets.
//
// Layering: the mobile player strip is z-index 2500 and the My Picks FAB is
// 2000. This has to cover both, so the mock's z-index 60 is raised to 3600.
const Z_BACKDROP = 3590;
const Z_DIALOG = 3600;

const MONO = "'Space Mono', monospace";

const TABS = [
  { id: "display", label: "Display" },
  { id: "betting", label: "Betting" },
];

export default function SettingsModal({ open, onClose, isNarrow, onOpenFullSettings }) {
  const settings = useSettings();
  const [tab, setTab] = React.useState("display");
  const { panelRef, requestClose } = useOverlay({ open, onClose, historyKey: "settingsModal" });

  if (!open) return null;

  const { theme, accentColor, oddsFormat, uiScale, timeZone, reduceMotion } = settings.display;
  const { defaultSport, sampleWindow, lean } = settings.betting;
  const setDisplay = (k, v) => settings.set("display", k, v);
  const setBetting = (k, v) => settings.set("betting", k, v);

  // The mock is a full-height panel against the right edge. A phone has no
  // room for that, so it keeps the bottom sheet every overlay in this app
  // uses at that width.
  const placement = isNarrow
    ? {
        left: 0, right: 0, bottom: 0, maxHeight: "88vh",
        borderRadius: "16px 16px 0 0", borderBottom: "none",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }
    : { top: 0, right: 0, bottom: 0, width: 372, borderLeft: "1px solid var(--line)" };

  return (
    <>
      <div
        onClick={requestClose}
        style={{
          position: "fixed", inset: 0, zIndex: Z_BACKDROP,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "fixed", zIndex: Z_DIALOG,
          background: "var(--surface-sunken)",
          border: isNarrow ? "1px solid var(--line)" : "none",
          padding: isNarrow ? "16px 18px" : "20px 22px 40px",
          overflow: "auto", outline: "none",
          ...placement,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          <span className="pp-mono" style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Settings</span>
          <span
            role="button" tabIndex={0}
            onClick={() => { requestClose(); onOpenFullSettings && onOpenFullSettings(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); onOpenFullSettings && onOpenFullSettings(); } }}
            className="pp-mono"
            style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--amber-ink, var(--amber))", cursor: "pointer" }}
          >
            All settings
          </span>
          <span
            role="button" tabIndex={0} onClick={requestClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); } }}
            aria-label="Close Settings"
            className="pp-mono"
            style={{ fontSize: 15, color: "var(--text-2)", cursor: "pointer" }}
          >
            ×
          </span>
        </div>

        <div style={{ display: "flex", gap: 22, marginTop: 16, borderBottom: "1px solid var(--line)" }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <span
                key={t.id}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab(t.id); } }}
                className="pp-mono"
                style={{
                  fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase",
                  paddingBottom: 10, marginBottom: -1, cursor: "pointer",
                  color: active ? "var(--amber-ink, var(--amber))" : "var(--dim)",
                  borderBottom: `2px solid ${active ? "var(--amber)" : "transparent"}`,
                }}
              >
                {t.label}
              </span>
            );
          })}
        </div>

        {tab === "display" && (
          <div style={{ marginTop: 18 }}>
            <Field label="Theme" hint="Auto follows your device's light/dark setting as it changes.">
              <Segmented options={THEMES} value={theme} onChange={(v) => setDisplay("theme", v)} ariaLabel="Theme" />
            </Field>

            <div style={{ paddingTop: 16, borderTop: "1px solid var(--line)", marginBottom: 22 }}>
              <Toggle
                checked={reduceMotion === true}
                onChange={(v) => setDisplay("reduceMotion", v ? true : null)}
                label="Reduce motion"
                hint="Turns off transitions and animations. Starts from your device setting."
              />
            </div>

            <div style={{ paddingTop: 16, borderTop: "1px solid var(--line)", marginBottom: 22 }}>
              <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)" }}>
                Accent colour
              </div>
              {/* Six swatches, not the wheel. Picking an exact hue is the
                  page's job; this is the one-tap version the file draws. */}
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                {ACCENT_PRESETS.map((a) => {
                  const on = (accentColor || ACCENT_PRESETS[0].hex).toLowerCase() === a.hex.toLowerCase();
                  return (
                    <span
                      key={a.hex}
                      role="button"
                      tabIndex={0}
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={on}
                      onClick={() => setDisplay("accentColor", a.hex)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDisplay("accentColor", a.hex); } }}
                      style={{
                        width: 26, height: 26, borderRadius: "50%", cursor: "pointer", flex: "none",
                        boxSizing: "border-box", background: a.hex,
                        border: `2px solid ${on ? "var(--text)" : "transparent"}`,
                      }}
                    />
                  );
                })}
              </div>
              {accentColor && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDisplay("accentColor", null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDisplay("accentColor", null); } }}
                  style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 14, cursor: "pointer", textDecoration: "underline" }}
                >
                  Reset to default
                </div>
              )}
            </div>

            <Field label="Odds format">
              <Segmented options={ODDS_FORMATS} value={oddsFormat} onChange={(v) => setDisplay("oddsFormat", v)} ariaLabel="Odds format" />
            </Field>
            <Field label="Display size" hint="Scales the whole interface, not just text.">
              <Segmented options={UI_SCALE} value={uiScale} onChange={(v) => setDisplay("uiScale", v)} ariaLabel="Display size" />
            </Field>
            <Field label="Time zone" hint="Game times are shown in this zone.">
              <select className="select" style={{ width: "100%" }} value={timeZone} onChange={(e) => setDisplay("timeZone", e.target.value)}>
                {TIME_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
              </select>
            </Field>
          </div>
        )}

        {tab === "betting" && (
          <div style={{ marginTop: 18 }}>
            <Field label="Default sport">
              <Segmented options={SPORT_OPTIONS} value={defaultSport} onChange={(v) => setBetting("defaultSport", v)} ariaLabel="Default sport" />
            </Field>
            <Field label="Default sample size" hint="Which hit-rate window the Prop Feed opens on.">
              <Segmented options={SAMPLE_WINDOWS} value={sampleWindow} onChange={(v) => setBetting("sampleWindow", v)} ariaLabel="Default sample size" />
            </Field>
            <Field label="Default side" hint="Which side of the line the feed is priced from when it loads.">
              <Segmented options={LEANS} value={lean} onChange={(v) => setBetting("lean", v)} ariaLabel="Default side" />
            </Field>
          </div>
        )}

        <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--dim)", marginTop: 8, lineHeight: 1.6 }}>
          Saved on this device under propPalaceSettings.
        </div>
      </div>
    </>
  );
}
