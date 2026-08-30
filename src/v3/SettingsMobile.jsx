import React from "react";
import { useSettings } from "../settings.jsx";
import {
  SECTIONS, DisplaySection, BettingSection, AccountSection, AboutSection,
} from "../SettingsSections.jsx";

// A transcription of frame `3d` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The frame's own caption is the brief: **layout only · every control kept.**
// So this is the chassis and nothing else — a 52px header row carrying ← BACK
// and the title, the four section pills scrolling horizontally under it, the
// body scroller, and the storage note at its foot. What goes inside is the
// four section components from `SettingsSections.jsx`, imported rather than
// re-authored, exactly as `SettingsPage.jsx` already does them for the desktop.
//
// That is deliberate and it is the one place in this redesign where the mock's
// own drawing is not copied to the pixel. The frame re-draws every control as
// its own primitive — segmented rectangles, a 48px select row, a track-and-knob
// toggle, and a 300px accent wheel in a bottom sheet. Re-authoring the controls
// is exactly how a setting goes missing, and `REDESIGN_PLAN.md` says of this
// screen: "every control from SettingsSections.jsx, nothing added, removed or
// renamed." Two things follow, both raised rather than hidden:
//
//   * the controls keep the app's own chrome inside the mock's chassis, and
//   * the accent bottom sheet is not built. `DisplaySection` already renders
//     the same `ColorWheel` inline with its own reset, so the function is
//     present; only the sheet presentation is absent.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

export default function SettingsMobile({ onLeave, returnLabel = "Prop Feed", sportsbooks }) {
  const settings = useSettings();
  const [section, setSection] = React.useState("display");

  // Escape leaves, the same as the desktop page: this is reached with one tap
  // on the cog, so the key that dismisses an overlay should work on it.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onLeave) onLeave(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  // The mock prints a different sentence on Account, because that is the tab
  // where "nothing leaves the device" is the answer to a question the reader
  // is actually asking.
  const storageNote = section === "account"
    ? "Nothing on this screen leaves the device. There is no account server to send it to."
    : "Every setting here is stored in this browser only, under propPalaceSettings.";

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
            style={{
              minWidth: 44, minHeight: 44, display: "flex", alignItems: "center",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)",
              whiteSpace: "nowrap", cursor: "pointer",
            }}
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
                  borderRadius: 8, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
                  flex: "0 0 auto",
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
          {section === "display" && <DisplaySection settings={settings} isNarrow />}
          {section === "betting" && <BettingSection settings={settings} sportsbooks={sportsbooks} />}
          {section === "account" && <AccountSection />}
          {section === "about" && <AboutSection settings={settings} />}

          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.7, color: "var(--dim)" }}>
            {storageNote}
          </span>
        </div>
      </div>
    </div>
  );
}
