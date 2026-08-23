import React from "react";
import { useSettings } from "./settings.jsx";
import { useOverlay } from "./useOverlay.js";
import {
  Field, Segmented,
  THEMES, ODDS_FORMATS, SAMPLE_WINDOWS, LEANS, SPORT_OPTIONS,
} from "./SettingsSections.jsx";

// --------------------------------------------------------------------------
// The cog's quick panel
// --------------------------------------------------------------------------
// This used to be the whole of Settings: four sections, both colour wheels,
// the glossary, the tutorial, bankroll and units, all in one 940x660 dialog
// that the cog opened from every screen in the app.
//
// It is five controls now. The full set moved to SettingsPage.jsx, which is
// the transcription of `PropPalace Settings v2.dc.html` -- and the split is
// the point rather than a side effect. Most of what was in here is set once
// and never touched again (time zone, display size, bankroll, exact colours,
// the 15-term glossary); a handful is flipped often enough that opening a
// full-page dialog to reach it was the wrong trade. Those five stay one click
// from anywhere, and "All settings" goes to the rest.
//
// The definitions are shared, not copied: `Segmented`, `Field` and the option
// lists all come from SettingsSections.jsx, which the page renders too, so a
// control cannot look like one thing here and another there.
//
// Layering: the mobile player strip is z-index 2500 and the My Picks FAB is
// 2000. Settings has to cover both, hence 3600.
const Z_BACKDROP = 3590;
const Z_DIALOG = 3600;

export default function SettingsModal({ open, onClose, isNarrow, onOpenFullSettings }) {
  const settings = useSettings();
  const { panelRef, requestClose } = useOverlay({ open, onClose, historyKey: "settingsModal" });

  if (!open) return null;

  const { theme, oddsFormat } = settings.display;
  const { defaultSport, sampleWindow, lean } = settings.betting;
  const setDisplay = (k, v) => settings.set("display", k, v);
  const setBetting = (k, v) => settings.set("betting", k, v);

  // Anchored under the cog on desktop, a bottom sheet on a phone -- the two
  // placements every overlay in this app uses at those widths.
  const placement = isNarrow
    ? {
        left: 0, right: 0, bottom: 0, maxHeight: "88vh",
        borderRadius: "16px 16px 0 0", borderBottom: "none",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }
    : { top: 64, right: 24, width: 340, maxHeight: "calc(100vh - 96px)", borderRadius: 12 };

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
          background: "var(--panel)", border: "1px solid var(--line)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden", outline: "none",
          ...placement,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>
          <span className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--dim)" }}>
            Settings
          </span>
          <div
            onClick={requestClose}
            role="button"
            tabIndex={0}
            aria-label="Close Settings"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); } }}
            style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 18px 4px" }}>
          <Field label="Theme">
            <Segmented options={THEMES} value={theme} onChange={(v) => setDisplay("theme", v)} ariaLabel="Theme" />
          </Field>
          <Field label="Odds format">
            <Segmented options={ODDS_FORMATS} value={oddsFormat} onChange={(v) => setDisplay("oddsFormat", v)} ariaLabel="Odds format" />
          </Field>
          <Field label="Default sport">
            <Segmented options={SPORT_OPTIONS} value={defaultSport} onChange={(v) => setBetting("defaultSport", v)} ariaLabel="Default sport" />
          </Field>
          <Field label="Default sample size" hint="Which hit-rate window the Prop Feed opens on.">
            <Segmented options={SAMPLE_WINDOWS} value={sampleWindow} onChange={(v) => setBetting("sampleWindow", v)} ariaLabel="Default sample size" />
          </Field>
          <Field label="Default side">
            <Segmented options={LEANS} value={lean} onChange={(v) => setBetting("lean", v)} ariaLabel="Default side" />
          </Field>
        </div>

        {/* The way to everything this panel does not carry. Named for where it
            goes rather than for what it is, so it never reads as a sixth
            control in the list above it. */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 18px", flexShrink: 0 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { requestClose(); onOpenFullSettings && onOpenFullSettings(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); requestClose(); onOpenFullSettings && onOpenFullSettings(); } }}
            className="pp-mono"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--amber-ink, var(--amber))", cursor: "pointer",
              minHeight: 44,
            }}
          >
            All settings
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </div>
    </>
  );
}
