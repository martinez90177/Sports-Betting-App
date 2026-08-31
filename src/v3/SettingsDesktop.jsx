import React from "react";
import { SettingsBody, SECTIONS, storageNoteFor, MONO, DISPLAY } from "./settingsFields.jsx";
import AgeMark from "./AgeMark.jsx";

// A transcription of frame `2h` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// A 232px rail of section tabs beside the fields. The chassis is all that
// differs from the phone frame — every field is `settingsFields.jsx`, shared,
// so a control cannot exist at one width and not the other.
//
// The control *set* is still `SettingsSections.jsx`'s, named and ordered
// exactly as its four sections expose them. Nothing is added, removed or
// renamed here: the frame's own caption is "layout only · every control kept".

export default function SettingsDesktop({ onLeave, returnLabel = "Prop Feed", sportsbooks = [] }) {
  const [section, setSection] = React.useState("display");

  React.useEffect(() => {
    // No sheet to dismiss here -- the wheel is inline at this width -- so
    // Escape leaves settings.
    const onKey = (e) => { if (e.key === "Escape" && onLeave) onLeave(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  const frameRef = React.useRef(null);
  const [height, setHeight] = React.useState(null);
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      setHeight(Math.max(420, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={frameRef}
      style={{
        position: "relative",
        height: height == null ? "70vh" : height, minHeight: 0,
        display: "flex", flexDirection: "column",
        background: "var(--bg)", overflow: "hidden",
        borderTop: "1px solid var(--line)",
      }}
    >
      {/* Settings is not one of the six nav tabs, so NAV_PAGES excludes it and
          no NavBar renders above this page. The frame draws its own row. */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 16, padding: "16px 32px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase" }}>Prop Palace</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: "var(--dim)" }}>SIGN IN</span>
          <AgeMark radius={7} />
        </span>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "232px minmax(0, 1fr)" }}>
        {/* ---- rail ------------------------------------------------------ */}
        <div className="nsb" style={{ borderRight: "1px solid var(--line)", overflowY: "auto", padding: "20px 16px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              role="button"
              tabIndex={0}
              onClick={onLeave}
              onKeyDown={(e) => { if (e.key === "Enter") onLeave && onLeave(); }}
              title={`Close settings and return to ${returnLabel}`}
              style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: "var(--amber-ink)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              ← BACK
            </span>
          </div>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 21 }}>Settings</span>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

          {/* Where these values live, and it changes on Account because that is
              the tab where "nothing leaves the device" answers a question the
              reader is actually asking. */}
          <span style={{ marginTop: "auto", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.7, color: "var(--dim)" }}>
            {storageNoteFor(section)}
          </span>
        </div>

        {/* ---- the fields ------------------------------------------------- */}
        <div className="nsb" style={{ overflowY: "auto", padding: "22px 28px 32px" }}>
          <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 22 }}>
            {/* No onOpenWheel: the accent ring is drawn inline at this width,
                which is what the frame does and what makes its own hint --
                "Drag the ring, or pick one below" -- true. */}
            <SettingsBody section={section} sportsbooks={sportsbooks} />
          </div>
        </div>
      </div>

    </div>
  );
}
