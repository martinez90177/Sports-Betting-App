import React from "react";
import { useSettings } from "../settings.jsx";
import { SettingsBody, AccentSheet, SECTIONS, storageNoteFor, MONO, DISPLAY } from "./settingsFields.jsx";

// A transcription of frame `3d` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The chassis only: a back bar, a scrolling row of section chips, and the
// fields. Every field lives in settingsFields.jsx and is shared with the
// desktop frame (2h), which differs only in putting those chips in a 232px
// rail.
//
// The control *set* is still SettingsSections.jsx's, named and ordered exactly
// as its four sections expose them. Nothing is added, removed or renamed.

export default function SettingsMobile({ onLeave, returnLabel = "Prop Feed", sportsbooks = [] }) {
  const settings = useSettings();
  const [section, setSection] = React.useState("display");
  const [wheelOpen, setWheelOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (wheelOpen) setWheelOpen(false); else if (onLeave) onLeave(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave, wheelOpen]);

  const d = settings.display;
  const setD = (k, v) => settings.set("display", k, v);




  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto" }}>
      <div style={{ flex: "0 0 auto", background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
          <span
            role="button"
            tabIndex={0}
            onClick={onLeave}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLeave && onLeave(); } }}
            title={`Close settings and return to ${returnLabel}`}
            style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)", whiteSpace: "nowrap", cursor: "pointer" }}
          >
            ← BACK
          </span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19 }}>Settings</span>
        </div>

        <div className="nsb" style={{ display: "flex", gap: 8, padding: "0 16px 10px", overflowX: "auto" }}>
          {SECTIONS.map((s) => {
            const on = section === s.id;
            return (
              <div
                key={s.id}
                role="tab"
                aria-selected={on}
                tabIndex={0}
                onClick={() => setSection(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSection(s.id); } }}
                style={{
                  minHeight: 40, display: "flex", alignItems: "center", padding: "0 13px",
                  borderRadius: 8, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer", flex: "0 0 auto",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                  background: on ? "var(--amber-dim)" : "var(--surface-1)",
                  color: on ? "var(--amber-ink)" : "var(--text-2)",
                }}
              >
                <span style={{ fontSize: 12, marginRight: 7, color: on ? "var(--amber-ink)" : "var(--dim)" }}>{s.icon}</span>
                {s.label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "16px 16px 26px", display: "flex", flexDirection: "column", gap: 22 }}>
          <SettingsBody section={section} sportsbooks={sportsbooks} onOpenWheel={() => setWheelOpen(true)} />

          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.7, color: "var(--dim)" }}>
            {storageNoteFor(section)}
          </span>
        </div>
      </div>

      {wheelOpen && (
        <AccentSheet
          value={d.accentColor}
          onPick={(hex) => setD("accentColor", hex)}
          onReset={() => setD("accentColor", null)}
          onClose={() => setWheelOpen(false)}
        />
      )}
    </div>
  );
}
