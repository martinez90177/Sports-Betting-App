import React from "react";
import { useSettings } from "./settings.jsx";
import NavBar from "./NavBar.jsx";
import {
  SECTIONS, DisplaySection, BettingSection, AccountSection, AboutSection,
} from "./SettingsSections.jsx";

// A transcription of `design_handoff_proppalace_v2/PropPalace Settings v2.dc.html`.
//
// The full set of settings, as a page. The cog still opens a panel, but that
// panel is five controls now (see SettingsModal.jsx) -- everything else lives
// here, which is what the mock designs: the app's nav across the top with a
// "Done ×" control added to it, then a `220px | 1fr` grid whose rail carries
// a back link, the title, the four section names, and the storage note.
//
// The four sections themselves are the same components the dialog rendered,
// imported from SettingsSections.jsx rather than rewritten, so a control
// cannot look like one thing in the panel and another here.
//
// `returnLabel`/`onLeave` are how the page gets you back where you were. The
// mock hard-codes "← Back to Prop Feed" because a static file has one place
// to go; a real page is reached from wherever the cog was clicked, so it
// names that page instead. Both the rail link and the nav's Done do it.

const MONO = "'PP At', 'Space Mono', monospace";
const DISPLAY = "'Bricolage Grotesque', sans-serif";

export default function SettingsPage({ returnLabel = "Prop Feed", onLeave, onNavigate, onHome, sportsbooks, isNarrow }) {
  const settings = useSettings();
  const [section, setSection] = React.useState("display");

  const leave = () => onLeave && onLeave();

  // Escape leaves too. The page is reached the way an overlay is -- one click
  // on the cog -- so the key that dismisses an overlay should work on it.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") leave(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const done = (
    <div
      role="button"
      tabIndex={0}
      onClick={leave}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); leave(); } }}
      title={`Close settings and return to ${returnLabel}`}
      style={{
        display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
        fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 12px",
      }}
    >
      Done
      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1, color: "var(--dim)" }}>×</span>
    </div>
  );

  return (
    <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", background: "var(--bg)", color: "var(--text)" }}>
      {/* No tab is active: Settings is not one of the four nav destinations,
          and lighting one up would claim you are somewhere you are not. */}
      <NavBar page={null} onNavigate={onNavigate} onHome={onHome} extraRight={done} />

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "220px minmax(0, 1fr)", gap: 0, alignItems: "start" }}>

        <div style={{
          borderRight: isNarrow ? "none" : "1px solid var(--line)",
          borderBottom: isNarrow ? "1px solid var(--line)" : "none",
          padding: "22px 0",
        }}>
          <div
            role="button"
            tabIndex={0}
            onClick={leave}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); leave(); } }}
            style={{
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--text-2)", padding: "0 22px 14px",
            }}
          >
            ← Back to {returnLabel}
          </div>

          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, padding: "0 22px 18px" }}>Settings</div>

          <div style={{ display: isNarrow ? "flex" : "block", gap: 4, overflowX: isNarrow ? "auto" : undefined, padding: isNarrow ? "0 18px" : 0 }}>
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <div
                  key={s.id}
                  role="tab"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => setSection(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSection(s.id); } }}
                  style={{
                    padding: isNarrow ? "10px 14px" : "11px 22px", cursor: "pointer", fontSize: 14,
                    whiteSpace: "nowrap",
                    color: active ? "var(--amber)" : "var(--dim)",
                    borderLeft: isNarrow ? "none" : `3px solid ${active ? "var(--amber)" : "transparent"}`,
                    borderBottom: isNarrow ? `2px solid ${active ? "var(--amber)" : "transparent"}` : "none",
                  }}
                >
                  {s.label}
                </div>
              );
            })}
          </div>

          {!isNarrow && (
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "var(--dim)", padding: "22px 22px 0", lineHeight: 1.6 }}>
              Saved on this device under propPalaceSettings. Nothing is sent anywhere.
            </div>
          )}
        </div>

        <div style={{ padding: isNarrow ? "20px 18px 48px" : "26px 30px 60px" }}>
          {section === "display" && <DisplaySection settings={settings} isNarrow={isNarrow} />}
          {section === "betting" && <BettingSection settings={settings} sportsbooks={sportsbooks} />}
          {section === "account" && <AccountSection />}
          {section === "about" && <AboutSection settings={settings} />}
        </div>
      </div>
    </div>
  );
}
