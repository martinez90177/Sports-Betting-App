import React, { useMemo, useState } from "react";
import { useSettings } from "./settings.jsx";
import { useOverlay } from "./useOverlay.js";
import { formatOdds } from "./odds.js";

const ColorWheel = React.lazy(() => import("./ColorWheel.jsx"));

// --------------------------------------------------------------------------
// Settings
// --------------------------------------------------------------------------
// Replaces the three-control right drawer this app shipped with (theme,
// default sportsbook, accent wheel). Sectioned dialog on anything with room
// for it, bottom sheet on phones -- the same two placements MLBDetailModal
// uses, so overlays in this app behave the same way at a given width.
//
// Layering: the mobile player strip is z-index 2500 and the My Picks FAB is
// 2000, both above the 2100 the old drawer sat at. Settings has to cover
// both, hence 3600 -- opening Settings from a player page with the old value
// put the strip on top of the dialog.
const Z_BACKDROP = 3590;
const Z_DIALOG = 3600;

const SECTIONS = [
  { id: "display", label: "Display", icon: "◐" },
  { id: "betting", label: "Betting", icon: "◎" },
  { id: "account", label: "Account", icon: "○" },
  { id: "about", label: "About", icon: "☰" },
];

// Kept in sync with the :root[data-ui-scale] rules in index.css.
const UI_SCALE = [
  { id: "small", label: "Small" },
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
];

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

const ODDS_FORMATS = [
  { id: "american", label: "American" },
  { id: "decimal", label: "Decimal" },
  { id: "fractional", label: "Fractional" },
];

// Ids must match FEED_WINDOWS in PropLedger.jsx -- these values are written
// straight into the feed's sampleWindow state on load.
const SAMPLE_WINDOWS = [
  { id: "l5", label: "L5" },
  { id: "l10", label: "L10" },
  { id: "l20", label: "L20" },
  { id: "all", label: "All" },
];

const LEANS = [
  { id: "over", label: "Over" },
  { id: "under", label: "Under" },
];

const SPORT_OPTIONS = [
  { id: "auto", label: "Auto (in season)" },
  { id: "nfl", label: "NFL" },
  { id: "mlb", label: "MLB" },
  { id: "nba", label: "NBA" },
  { id: "wnba", label: "WNBA" },
];

// A short, stable list rather than the full IANA set: these are the zones a
// US sports audience actually reads lines in, plus "auto" for everyone else,
// which is already correct for the vast majority of viewers.
const TIME_ZONES = [
  { id: "auto", label: "Auto — follow this device" },
  { id: "America/New_York", label: "Eastern" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Phoenix", label: "Arizona (no DST)" },
  { id: "America/Los_Angeles", label: "Pacific" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
];

// ---------- shared bits ----------

function SectionTitle({ children }) {
  return (
    <div
      className="oswald"
      style={{
        fontSize: 12.5, fontWeight: 600, color: "var(--dim)",
        letterSpacing: "0.03em", marginBottom: 8, textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionTitle>{label}</SectionTitle>
      {hint && (
        <div style={{ fontSize: 11.5, color: "var(--dim)", marginBottom: 10, lineHeight: 1.45 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

// The segmented pill used for every either/or in here. Built on the existing
// .chip class so it picks up the accent and both themes for free.
function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <div
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          tabIndex={0}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(o.id);
            }
          }}
          className={`chip${value === o.id ? " active" : ""}`}
          style={{ flex: "1 1 0", minWidth: 76, textAlign: "center", cursor: "pointer" }}
        >
          {o.label}
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, cursor: "pointer", padding: "10px 0",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <div
        style={{
          flexShrink: 0, width: 40, height: 23, borderRadius: 999,
          background: checked ? "var(--amber)" : "var(--surface-3, var(--panel2))",
          border: `1px solid ${checked ? "var(--amber)" : "var(--line)"}`,
          position: "relative", transition: "background 120ms ease",
        }}
      >
        <div
          style={{
            position: "absolute", top: 2, left: checked ? 19 : 2,
            width: 17, height: 17, borderRadius: 999,
            background: checked ? "var(--accent-on)" : "var(--dim)",
            transition: "left 120ms ease",
          }}
        />
      </div>
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder, prefix = "$" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--dim)", fontSize: 13 }}>{prefix}</span>
      <input
        className="select"
        inputMode="decimal"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") return onChange(null);
          const n = Number(raw.replace(/[^0-9.]/g, ""));
          onChange(Number.isFinite(n) ? n : null);
        }}
        style={{ width: 130 }}
      />
    </div>
  );
}

// ---------- sections ----------

function DisplaySection({ settings }) {
  const { theme, accentColor, oddsFormat, uiScale, timeZone } = settings.display;
  const set = (k, v) => settings.set("display", k, v);

  // Shows the chosen format on a real pair of prices rather than describing
  // it in prose -- "+150 and -180" answers "which one is this?" faster than
  // the word "American" does. Separated by "and" rather than a slash because
  // fractional prices contain slashes ("3/2 / 5/9" reads as nonsense).
  const sampleOdds = `${formatOdds(150, oddsFormat)} and ${formatOdds(-180, oddsFormat)}`;

  return (
    <>
      <Field label="Theme" hint="Auto follows your device's light/dark setting as it changes.">
        <Segmented options={THEMES} value={theme} onChange={(v) => set("theme", v)} ariaLabel="Theme" />
      </Field>

      <Field label="Odds format" hint={`Applied everywhere odds appear. Currently showing ${sampleOdds}.`}>
        <Segmented options={ODDS_FORMATS} value={oddsFormat} onChange={(v) => set("oddsFormat", v)} ariaLabel="Odds format" />
      </Field>

      <Field label="Display size" hint="Scales the whole interface, not just text.">
        <Segmented options={UI_SCALE} value={uiScale} onChange={(v) => set("uiScale", v)} ariaLabel="Display size" />
      </Field>

      <Field label="Time zone" hint="Game times are shown in this zone.">
        <select className="select" value={timeZone} onChange={(e) => set("timeZone", e.target.value)} style={{ width: "100%" }}>
          {TIME_ZONES.map((z) => (
            <option key={z.id} value={z.id}>{z.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Motion">
        <Toggle
          checked={settings.reduceMotion}
          onChange={(v) => set("reduceMotion", v)}
          label="Reduce motion"
          hint="Turns off transitions and animations. Starts from your device setting."
        />
      </Field>

      <Field label="Accent color" hint="Used for active tabs, buttons, and chart highlights.">
        <React.Suspense fallback={<div style={{ minHeight: 180 }} />}>
          <ColorWheel value={accentColor} onChange={(v) => set("accentColor", v)} />
        </React.Suspense>
        {/* Passing null clears --accent-color entirely rather than setting it
            back to the blue hex -- that's what lets each theme fall back to
            its own tuned default again (see SettingsProvider). */}
        {accentColor && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => set("accentColor", null)}
            onKeyDown={(e) => { if (e.key === "Enter") set("accentColor", null); }}
            style={{
              marginTop: 12, textAlign: "center", fontSize: 11.5,
              color: "var(--dim)", cursor: "pointer", textDecoration: "underline",
            }}
          >
            Reset to default
          </div>
        )}
      </Field>
    </>
  );
}

function BettingSection({ settings, sportsbooks }) {
  const b = settings.betting;
  const set = (k, v) => settings.set("betting", k, v);
  const book = sportsbooks.find((x) => x.id === b.sportsbook) || sportsbooks[0];

  // What one unit is actually worth, resolved from whichever mode is active.
  // Shown back to the user because "1% of bankroll" is not a number anyone
  // holds in their head while reading a slip.
  const unitValue = b.bankroll
    ? b.unitMode === "percent"
      ? (b.bankroll * b.unitPercent) / 100
      : b.unitSize
    : null;

  return (
    <>
      <Field label="Default sport" hint="Which board the app opens on. Auto picks whatever is in season.">
        <select className="select" value={b.defaultSport} onChange={(e) => set("defaultSport", e.target.value)} style={{ width: "100%" }}>
          {SPORT_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Default sportsbook" hint={`Used for the "Open in ${book.label} →" button in My Picks.`}>
        <select className="select" value={b.sportsbook} onChange={(e) => set("sportsbook", e.target.value)} style={{ width: "100%" }}>
          {sportsbooks.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Bankroll"
        hint="Optional. Set it and the Ledger reports profit in dollars as well as units. Nothing is sent anywhere — it stays in this browser."
      >
        <MoneyInput value={b.bankroll} onChange={(v) => set("bankroll", v)} placeholder="1000" />
      </Field>

      <Field label="Unit size" hint="One unit is the stake behind every hit-rate and profit figure in the Ledger.">
        <Segmented
          options={[{ id: "fixed", label: "Fixed $" }, { id: "percent", label: "% of bankroll" }]}
          value={b.unitMode}
          onChange={(v) => set("unitMode", v)}
          ariaLabel="Unit size mode"
        />
        <div style={{ marginTop: 10 }}>
          {b.unitMode === "percent" ? (
            <MoneyInput value={b.unitPercent} onChange={(v) => set("unitPercent", v ?? 1)} placeholder="1" prefix="%" />
          ) : (
            <MoneyInput value={b.unitSize} onChange={(v) => set("unitSize", v ?? 0)} placeholder="10" />
          )}
        </div>
        {unitValue != null && (
          <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 8 }}>
            1 unit = ${unitValue.toFixed(2)}
          </div>
        )}
        {b.bankroll == null && b.unitMode === "percent" && (
          <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 8 }}>
            Set a bankroll above to use percentage units.
          </div>
        )}
      </Field>

      <Field label="Default sample size" hint="Which hit-rate window the Prop Feed opens on.">
        <Segmented options={SAMPLE_WINDOWS} value={b.sampleWindow} onChange={(v) => set("sampleWindow", v)} ariaLabel="Default sample size" />
      </Field>

      <Field label="Default side" hint="Which side of the line the feed is priced from when it loads.">
        <Segmented options={LEANS} value={b.lean} onChange={(v) => set("lean", v)} ariaLabel="Default side" />
      </Field>
    </>
  );
}

function AccountSection() {
  return (
    <>
      <Field label="Account">
        <div
          style={{
            border: "1px solid var(--line)", borderRadius: "var(--r-lg, 10px)",
            padding: 18, textAlign: "center", background: "var(--surface-2, var(--panel2))",
          }}
        >
          <div className="oswald" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            Accounts are coming
          </div>
          <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.5 }}>
            PropPalace doesn't need one yet. Your settings, picks and saved
            screens live in this browser and work without signing in.
          </div>
        </div>
      </Field>

      <Field label="Your data" hint="Everything below is stored locally on this device.">
        <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.7 }}>
          <div>· Saved picks and settled results</div>
          <div>· Display and betting preferences</div>
          <div>· Saved screens in the Prop Feed</div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 10, lineHeight: 1.45 }}>
          Clearing your browser data for this site removes all of it. Signing in
          will be the way to carry it between devices.
        </div>
      </Field>
    </>
  );
}

const DISCORD_INVITE = "https://discord.gg/DbrPwnrW6P";

// Every definition here describes what this app actually computes, not the
// general betting sense of the term -- the numbers are checked against the
// code that produces them (defTier, FEED_FORM_GAMES, noVigProbability,
// REPORT_MIN_SAMPLE, pickUnitProfit). If any of those change, these change.
const GLOSSARY = [
  {
    term: "Hit rate",
    def: "How often this player cleared the line over the selected window — the L5 / L10 / L20 / Season columns. It's the player's own game log, not a projection.",
  },
  {
    term: "L5 · L10 · L20 · Season",
    def: "The sample the hit rate is measured over: the last 5, 10 or 20 games, or the full season. A short window reacts fastest and is the easiest to be fooled by.",
  },
  {
    term: "Line",
    def: "The number the prop is set at. The small figure beneath it is the player's average over the selected window, so you can see how much room there is above or below the line.",
  },
  {
    term: "Form",
    def: "The player's last 10 games as one bar per game. Green cleared the line, red missed it, and bar height is how far past it they went — so a row of tall green bars is a very different story from a row of narrow ones.",
  },
  {
    term: "Straight",
    def: "The run of same-coloured bars at the end of the Form strip — the current streak, underlined in place rather than restated as a separate number.",
  },
  {
    term: "Opp rank",
    def: "How the opposing defence ranks against this stat. #1 is the toughest matchup in the league and the highest number is the easiest — so a high number is good for an Over.",
  },
  {
    term: "Soft / Average / Tough matchup",
    def: "The colour on the Opp rank badge. Ranks 1–10 are tough (red), 21 and up are soft (green), and the middle is average — for NFL the soft band starts at 22, since it has more teams.",
  },
  {
    term: "In posted lineup · Projected lineup",
    def: "MLB only. A filled dot means the team has officially posted its lineup and this player is in it. A hollow dot means the lineup isn't out yet and this is the projection, so they could be rested.",
  },
  {
    term: "Odds",
    def: "The price on the side shown. These are derived from the hit rate, not pulled from a sportsbook — real posted prices only appear in the MLB odds panel.",
  },
  {
    term: "Implied probability",
    def: "The chance a price corresponds to. A price of -150 implies 60%, so if the player clears the line more often than that, the price is the interesting part.",
  },
  {
    term: "No-vig probability",
    def: "A book prices Over and Under so they add up to more than 100%; the excess is its fee, not an opinion. Normalising the pair back to 100% leaves the book's actual estimate — the only number worth comparing a hit rate against. Needs both sides posted.",
  },
  {
    term: "Unit",
    def: "One stake. The Ledger grades every pick at a flat 1 unit so results are comparable, and shows dollars too once you set a bankroll in Betting.",
  },
  {
    term: "ROI",
    def: "Profit in units divided by the number of settled picks. At a flat 1 unit a pick, that's return per unit risked.",
  },
  {
    term: "Correlation",
    def: "Two legs that move together — same player, or same game. A parlay price assumes legs are independent, so when they aren't, the quoted payout flatters the slip. Flagged as a heuristic, not a corrected price.",
  },
  {
    term: "Thin sample",
    def: "Fewer than 20 settled picks. Below that a record is mostly noise, and the Report says so before it shows you any breakdown of it.",
  },
];

const GLOSSARY_BY_TERM = Object.fromEntries(GLOSSARY.map((g) => [g.term, g.def]));

// Grouped for scanability -- the flat 14-entry list read as a wall of text
// behind one big toggle. Term text still comes from GLOSSARY above, so the
// two can never drift out of sync.
const GLOSSARY_GROUPS = [
  {
    title: "Reading the board",
    terms: ["Hit rate", "L5 · L10 · L20 · Season", "Line", "Form", "Straight"],
  },
  {
    title: "Matchup & difficulty",
    terms: ["Opp rank", "Soft / Average / Tough matchup", "In posted lineup · Projected lineup"],
  },
  {
    title: "Odds & value",
    terms: ["Odds", "Implied probability", "No-vig probability"],
  },
  {
    title: "Tracking results",
    terms: ["Unit", "ROI", "Correlation", "Thin sample"],
  },
];

function LinkRow({ label, hint, action, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 0", borderBottom: "1px solid var(--line)",
        textDecoration: "none", color: "inherit",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "var(--amber)" }}>{action} →</span>
    </a>
  );
}

function AboutSection({ settings }) {
  const [openGlossaryGroups, setOpenGlossaryGroups] = useState(() => new Set());
  const toggleGlossaryGroup = (title) => {
    setOpenGlossaryGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <>
      <Field label="Community">
        <LinkRow
          href={DISCORD_INVITE}
          label="Join the Discord"
          hint="Talk through slates, share screens, and see what everyone else is on."
          action="Open"
        />
        {/* Feature requests go to the same place rather than an email or a
            form: it needs no backend, the reply is public so the next person
            asking finds the answer, and it puts anyone with an opinion about
            the product in the room with everyone else. */}
        <LinkRow
          href={DISCORD_INVITE}
          label="Request a feature"
          hint="Post it in the Discord — that's where the roadmap gets argued about."
          action="Open"
        />
      </Field>

      <Field label="Glossary" hint={`What every number on the board actually means — ${GLOSSARY.length} terms across ${GLOSSARY_GROUPS.length} categories.`}>
        <div style={{ marginTop: 4 }}>
          {GLOSSARY_GROUPS.map((group) => {
            const open = openGlossaryGroups.has(group.title);
            return (
              <div key={group.title} style={{ marginTop: 12 }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGlossaryGroup(group.title)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGlossaryGroup(group.title); } }}
                  className="chip"
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <span className="oswald" style={{ fontWeight: 700, letterSpacing: "0.02em" }}>{group.title}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>({group.terms.length})</span>
                  <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
                </div>
                {open && (
                  <div style={{ marginTop: 10, paddingLeft: 2, borderTop: "1px solid var(--line)" }}>
                    {group.terms.map((term) => (
                      <div key={term} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                        <div className="oswald" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", letterSpacing: "0.02em" }}>
                          {term}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5, marginTop: 4 }}>{GLOSSARY_BY_TERM[term]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <Field label="About">
        <div style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6 }}>
          PropPalace — your own hit-rate research, before you place it.
        </div>
      </Field>

      <Field
        label="Reset"
        hint="Puts display and betting settings back to their defaults. Your saved picks and saved screens are not touched."
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div
            role="button"
            tabIndex={0}
            className="chip"
            onClick={() => settings.resetSection("display")}
            style={{ cursor: "pointer" }}
          >
            Reset display
          </div>
          <div
            role="button"
            tabIndex={0}
            className="chip"
            onClick={() => settings.resetSection("betting")}
            style={{ cursor: "pointer" }}
          >
            Reset betting
          </div>
        </div>
      </Field>
    </>
  );
}

// ---------- shell ----------

export default function SettingsModal({ open, onClose, isNarrow, sportsbooks }) {
  const settings = useSettings();
  const [section, setSection] = useState("display");
  const { panelRef, requestClose } = useOverlay({ open, onClose, historyKey: "settingsModal" });

  const placement = useMemo(
    () =>
      isNarrow
        ? {
            left: 0, right: 0, bottom: 0,
            maxHeight: "92vh", borderRadius: "16px 16px 0 0",
            borderBottom: "none",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }
        : {
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(860px, 94vw)", height: "min(640px, 86vh)",
            borderRadius: 16,
          },
    [isNarrow]
  );

  if (!open) return null;

  const rail = (
    <div
      style={
        isNarrow
          ? { display: "flex", gap: 6, overflowX: "auto", padding: "10px 14px", borderBottom: "1px solid var(--line)" }
          : { width: 186, flexShrink: 0, borderRight: "1px solid var(--line)", padding: 12, overflowY: "auto" }
      }
    >
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
            className="oswald"
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: isNarrow ? "8px 13px" : "9px 11px",
              marginBottom: isNarrow ? 0 : 3,
              borderRadius: "var(--r-sm, 4px)",
              whiteSpace: "nowrap", cursor: "pointer",
              fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
              color: active ? "var(--amber)" : "var(--dim)",
              background: active ? "var(--amber-dim)" : "transparent",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.9 }}>{s.icon}</span>
            {s.label}
          </div>
        );
      })}
    </div>
  );

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
          display: "flex", flexDirection: "column", overflow: "hidden",
          outline: "none",
          ...placement,
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "15px 18px", borderBottom: "1px solid var(--line)", flexShrink: 0,
          }}
        >
          <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em" }}>SETTINGS</span>
          <div
            onClick={requestClose}
            role="button"
            tabIndex={0}
            aria-label="Close Settings"
            onKeyDown={(e) => { if (e.key === "Enter") requestClose(); }}
            style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: isNarrow ? "column" : "row", flex: 1, minHeight: 0 }}>
          {rail}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 20px" }}>
            {section === "display" && <DisplaySection settings={settings} />}
            {section === "betting" && <BettingSection settings={settings} sportsbooks={sportsbooks} />}
            {section === "account" && <AccountSection />}
            {section === "about" && <AboutSection settings={settings} />}
          </div>
        </div>
      </div>
    </>
  );
}
