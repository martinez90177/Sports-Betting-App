import React from "react";
import { useSettings, STATUS_PALETTES, statusPaletteById } from "../settings.jsx";
import {
  SECTIONS, THEMES, ODDS_FORMATS, UI_SCALE, SAMPLE_WINDOWS, LEANS,
  SPORT_OPTIONS, TIME_ZONES, AccountSection, AboutSection,
} from "../SettingsSections.jsx";

// A transcription of frame `3d` in `v3 Mocks/PropPalace Mobile v3.dc.html`.
//
// The frame's caption is "layout only · every control kept", and both halves of
// that are load-bearing. The control *set* is `SettingsSections.jsx`'s, named
// and ordered exactly as its four sections expose them — nothing added, removed
// or renamed. The control *drawing* is the frame's: `setFields` renders each
// one through one of eight primitives, and those are what this file builds.
//
// An earlier pass put the mock's chassis around the app's own control chrome.
// That was the "applied the concepts to v1" failure this redesign exists to
// avoid, and Alex called it: "have EVERYTHING be an EXACT V3 COPY".
//
// Every control still reads and writes the same settings store, so a value set
// here is the value the desktop page shows.

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const hint = { fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)" };
const label = { fontSize: 14.5, fontWeight: 600 };

// ---------------------------------------------------------------------------
// The eight primitives `setFields` draws
// ---------------------------------------------------------------------------

// Segmented rectangles butted together, one primitive for every choice, so
// Theme and Odds format read as one family of control.
function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <div
            key={o.id}
            role="radio"
            aria-checked={on}
            tabIndex={0}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(o.id); } }}
            style={{
              flex: "1 1 0", minWidth: 0, minHeight: 46, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 7, cursor: "pointer", fontSize: 13.5,
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
              background: on ? "var(--amber)" : "var(--surface-1)",
              color: on ? "var(--accent-on)" : "var(--text-2)",
              fontWeight: on ? 700 : 400,
            }}
          >
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

function SelectRow({ options, value, onChange, ariaLabel }) {
  return (
    <div style={{ position: "relative", minHeight: 48, display: "flex", alignItems: "center", gap: 10, padding: "0 13px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)" }}>
      <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {(options.find((o) => o.id === value) || {}).label || value}
      </span>
      <span style={{ color: "var(--dim)", fontSize: 11 }}>▾</span>
      {/* The native control on top, so the row is a real select on a phone
          rather than a div that opens nothing. */}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ToggleRow({ checked, onChange, label: text }) {
  return (
    <div
      role="switch"
      aria-checked={!!checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked); } }}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, cursor: "pointer" }}
    >
      <span
        style={{
          width: 46, height: 28, borderRadius: 999, flex: "0 0 auto", position: "relative",
          background: checked ? "var(--amber)" : "var(--surface-2)",
          border: `1px solid ${checked ? "var(--amber)" : "var(--line)"}`,
        }}
      >
        <span
          style={{
            position: "absolute", top: 2, left: checked ? 20 : 2, width: 22, height: 22,
            borderRadius: 999, background: checked ? "var(--accent-on)" : "var(--dim)", display: "block",
          }}
        />
      </span>
      <span style={{ fontSize: 14, color: "var(--text)" }}>{text}</span>
    </div>
  );
}

function InputRow({ value, onChange, prefix = "$", placeholder }) {
  return (
    <div style={{ minHeight: 48, display: "flex", alignItems: "center", gap: 8, padding: "0 13px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-1)" }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: "var(--dim)" }}>{prefix}</span>
      <input
        value={value == null ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        style={{ flex: "1 1 auto", minWidth: 0, fontFamily: MONO, fontSize: 14, color: "var(--text)", background: "transparent", border: "none", outline: "none" }}
      />
    </div>
  );
}

// Cleared filled, fell short outlined -- drawn the way the graph draws it, so
// the choice is legible as the thing it changes.
function PaletteRows({ value, onPick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {STATUS_PALETTES.map((p) => {
        const on = p.id === value;
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => onPick(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 12px",
              borderRadius: 10, cursor: "pointer", minHeight: 44,
              border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
              background: on ? "var(--amber-dim)" : "var(--surface-1)",
            }}
          >
            <span style={{ display: "flex", alignItems: "flex-end", gap: 3, flex: "0 0 auto" }}>
              <span style={{ width: 9, height: 26, borderRadius: 2, background: p.pos, display: "block" }} />
              <span style={{ width: 9, height: 18, borderRadius: 2, display: "block", background: "transparent", border: `1.5px solid ${p.neg}`, boxSizing: "border-box" }} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.label}</span>
              <span style={{ fontSize: 12, color: "var(--dim)", textWrap: "pretty" }}>{p.note}</span>
            </span>
          </div>
        );
      })}
      <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>
        Picked as pairs rather than two free wheels: fill versus outline still carries the meaning at
        any hue, so a close pair is a bad idea rather than a broken one.
      </span>
    </div>
  );
}

function Field({ label: text, hint: sub, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <span style={label}>{text}</span>
      {sub ? <span style={hint}>{sub}</span> : null}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The accent wheel, and its sheet
// ---------------------------------------------------------------------------
// "300px against the preview's 52px: a hue is actually pickable here."
const WHEEL_CONIC = "conic-gradient(from 90deg, #ef5b5b, #e8823a, #e8b13a, #a8cf3e, #3ecf8e, #2bb8a6, #4c9ff0, #3b5bdb, #8b5bd6, #d6409f, #ef5b5b)";
const PRESETS = [["#3b5bdb", 232], ["#4c9ff0", 210], ["#2bb8a6", 172], ["#3ecf8e", 152], ["#8b5bd6", 268], ["#d6409f", 320]];
const DEFAULT_ANGLE = 232;

// The ring's own hue at an angle, so dragging and the presets agree.
function hueHex(deg) {
  const h = ((deg % 360) + 360) % 360;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = 0.55 * Math.min(0.62, 1 - 0.62);
    const v = 0.62 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const angleOf = (hex) => {
  const found = PRESETS.find((p) => p[0].toLowerCase() === String(hex || "").toLowerCase());
  return found ? found[1] : null;
};

function AccentSheet({ value, onPick, onReset, onClose }) {
  const current = value || "#3b5bdb";
  const [angle, setAngle] = React.useState(() => angleOf(current) ?? DEFAULT_ANGLE);

  const drag = (e) => {
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const at = (x, y) => Math.round((Math.atan2(y - cy, x - cx) * 180 / Math.PI + 450) % 360);
    const apply = (ev) => {
      const deg = at(ev.clientX, ev.clientY);
      setAngle(deg);
      onPick(hueHex(deg));
    };
    apply(e);
    const up = () => {
      window.removeEventListener("pointermove", apply);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", apply);
    window.addEventListener("pointerup", up);
  };

  const rad = ((angle - 90) * Math.PI) / 180;
  const r = 121;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(5,6,8,0.78)" }} />
      <div
        className="nsb"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, background: "var(--surface-1)",
          borderTop: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: "12px 18px 26px",
          display: "flex", flexDirection: "column", gap: 16, maxHeight: "92%", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ width: 40, height: 4, borderRadius: 999, background: "var(--line)", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20 }}>Accent colour</span>
          <span
            role="button"
            tabIndex={0}
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }}
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 0" }}>
          <div
            onPointerDown={drag}
            style={{
              position: "relative", width: 300, height: 300, borderRadius: 999,
              touchAction: "none", cursor: "crosshair", userSelect: "none", background: WHEEL_CONIC,
            }}
          >
            <span style={{ position: "absolute", inset: 58, borderRadius: 999, background: "var(--surface-1)", display: "block", pointerEvents: "none" }} />
            <span
              style={{
                position: "absolute",
                left: `calc(50% + ${Math.round(Math.cos(rad) * r)}px - 14px)`,
                top: `calc(50% + ${Math.round(Math.sin(rad) * r)}px - 14px)`,
                width: 28, height: 28, borderRadius: 999,
                border: "3px solid #ffffff", boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
                background: current, boxSizing: "border-box", display: "block", pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 0" }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, background: current, border: "1px solid var(--line)", flex: "0 0 auto", display: "block" }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 auto", minWidth: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{current.toUpperCase()}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{`${angle}° ON THE RING`}</span>
          </span>
          {/* Only once something has been chosen. Passing null clears the accent
              entirely rather than freezing the reader onto whatever hex happened
              to be default -- see SettingsProvider. */}
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={() => { onReset(); setAngle(DEFAULT_ANGLE); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onReset(); setAngle(DEFAULT_ANGLE); } }}
              style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--amber-ink)", flex: "0 0 auto", cursor: "pointer", textAlign: "right" }}
            >
              RESET TO DEFAULT
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>OR PICK ONE</span>
          <div style={{ display: "flex", gap: 8 }}>
            {PRESETS.map(([hex, deg]) => (
              <div
                key={hex}
                role="button"
                tabIndex={0}
                onClick={() => { setAngle(deg); onPick(hex); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAngle(deg); onPick(hex); } }}
                style={{
                  flex: "1 1 0", height: 44, borderRadius: 10, background: hex, cursor: "pointer",
                  border: `2px solid ${current.toLowerCase() === hex ? "#ffffff" : "transparent"}`,
                  boxSizing: "border-box", display: "block",
                }}
              />
            ))}
          </div>
        </div>

        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--dim)", textWrap: "pretty" }}>
          The accent marks what is selected or interactive. It never colours a result — cleared and
          fell short have their own pair below.
        </span>

        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }}
          style={{
            minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 12, border: "1px solid var(--amber)", background: "var(--amber)",
            color: "var(--accent-on)", fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", cursor: "pointer",
          }}
        >
          DONE
        </div>
      </div>
    </>
  );
}

// The 52px preview row that opens it.
function WheelRow({ value, onOpen, onReset }) {
  const shown = value || "#3b5bdb";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: 13, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", cursor: "pointer" }}
    >
      <span style={{ width: 52, height: 52, borderRadius: 999, flex: "0 0 auto", position: "relative", display: "block", background: "conic-gradient(#ef5b5b, #e8b13a, #3ecf8e, #2bb8a6, #3b5bdb, #8b5bd6, #ef5b5b)" }}>
        <span style={{ position: "absolute", top: "50%", left: "50%", width: 18, height: 18, marginTop: -9, marginLeft: -9, borderRadius: 999, background: shown, border: "2px solid var(--bg)", display: "block" }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: "1 1 auto" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--text)" }}>{shown.toUpperCase()}</span>
        <span style={{ fontSize: 12, color: "var(--dim)" }}>Tap to open a bigger wheel.</span>
      </span>
      {value && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onReset(); } }}
          style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--amber-ink)", flex: "0 0 auto", cursor: "pointer" }}
        >
          RESET
        </span>
      )}
      <span style={{ color: "var(--dim)", fontSize: 13 }}>›</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

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
  const b = settings.betting;
  const setD = (k, v) => settings.set("display", k, v);
  const setB = (k, v) => settings.set("betting", k, v);

  const opts = (list) => list.map((o) => ({ id: o.id ?? o.value ?? o, label: o.label ?? String(o) }));

  const bookOptions = (sportsbooks || []).map((s) => ({ id: s.id, label: s.label }));

  // The frame's own storage note, which changes on Account because that is the
  // tab where "nothing leaves the device" answers a question being asked.
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
          {section === "display" && (
            <>
              <Field label="Theme" hint="Auto follows your device's light/dark setting as it changes.">
                <Segmented options={opts(THEMES)} value={d.theme} onChange={(v) => setD("theme", v)} ariaLabel="Theme" />
              </Field>
              <Field label="Motion" hint="Starts from your device setting.">
                <ToggleRow checked={!!settings.reduceMotion} onChange={(v) => setD("reduceMotion", v)} label="Reduce motion" />
              </Field>
              <Field label="Accent colour" hint="Used for anything selected or interactive — never for a result.">
                <WheelRow value={d.accentColor} onOpen={() => setWheelOpen(true)} onReset={() => setD("accentColor", null)} />
              </Field>
              <Field
                label="Outcome colours"
                hint="What a cleared game and a game that fell short look like on every graph and rate. Availability is deliberately not affected — a player's injury status keeps its own colours whatever you pick here."
              >
                <PaletteRows
                  value={d.posColor || d.negColor ? null : d.statusPalette}
                  onPick={(id) => { setD("statusPalette", id); setD("posColor", null); setD("negColor", null); }}
                />
              </Field>
              <Field label="Odds format" hint={`Applied everywhere odds appear. Currently showing ${(ODDS_FORMATS.find((o) => o.id === d.oddsFormat) || {}).label || d.oddsFormat}.`}>
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

          {section === "betting" && (
            <>
              <Field label="Default sport" hint="Which board the app opens on. Auto picks whatever is in season.">
                <SelectRow options={opts(SPORT_OPTIONS)} value={b.defaultSport} onChange={(v) => setB("defaultSport", v)} ariaLabel="Default sport" />
              </Field>
              <Field label="Default sportsbook" hint="Prices on the My Picks slip come from this book.">
                <Segmented options={bookOptions} value={b.sportsbook} onChange={(v) => setB("sportsbook", v)} ariaLabel="Default sportsbook" />
              </Field>
              <Field label="Bankroll" hint="Optional. Set it and the Ledger reports profit in dollars as well as units. Nothing is sent anywhere — it stays in this browser.">
                <InputRow value={b.bankroll} onChange={(v) => setB("bankroll", v)} placeholder="1,000" />
              </Field>
              <Field label="Unit size" hint="One unit is the stake behind every hit-rate and profit figure in the Ledger.">
                <Segmented
                  options={[{ id: "fixed", label: "Fixed $" }, { id: "percent", label: "% of bankroll" }]}
                  value={b.unitMode}
                  onChange={(v) => setB("unitMode", v)}
                  ariaLabel="Unit size"
                />
              </Field>
              <Field label="Default sample size" hint="Which hit-rate window the Prop Feed opens on.">
                <Segmented options={opts(SAMPLE_WINDOWS)} value={b.sampleWindow} onChange={(v) => setB("sampleWindow", v)} ariaLabel="Default sample size" />
              </Field>
              <Field label="Default side" hint="Which side of the line the feed is priced from when it loads.">
                <Segmented options={opts(LEANS)} value={b.lean} onChange={(v) => setB("lean", v)} ariaLabel="Default side" />
              </Field>
            </>
          )}

          {/* Account and About are the frame's `rows` and `note` kinds, and the
              app's own components already draw exactly those two shapes -- a
              bordered list of label/hint/action rows, and a paragraph. Nothing
              would be transcribed by copying them out. */}
          {section === "account" && <AccountSection />}
          {section === "about" && <AboutSection settings={settings} />}

          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", lineHeight: 1.7, color: "var(--dim)" }}>
            {storageNote}
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
