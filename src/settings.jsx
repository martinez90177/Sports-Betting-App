import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// --------------------------------------------------------------------------
// Preferences
// --------------------------------------------------------------------------
// Every user preference lives in one versioned object under one localStorage
// key, rather than the key-per-setting/useEffect-per-key arrangement this
// replaces. That pattern was fine at three settings and does not survive
// twenty: each one cost a useState + a useEffect in the root component, and
// nothing outside that component could read a preference without having it
// threaded down as a prop.
//
// Saved picks (propLedgerPicks) deliberately stay out of here. They're user
// *data* -- a record of what someone actually bet -- not a preference, and
// they have their own grading lifecycle in PropLedger.
const STORAGE_KEY = "propPalaceSettings";
const SCHEMA_VERSION = 1;

// The default sportsbook id has to match SPORTSBOOKS[0].id in PropLedger.jsx.
// It isn't imported from there because that module is the 16k-line app and
// this one is loaded before it -- see the migration note below.
export const DEFAULTS = {
  display: {
    // "auto" follows the OS. Stored distinctly from the resolved value so
    // toggling the OS appearance keeps following it; see useResolvedTheme.
    theme: "dark",
    accentColor: null,
    oddsFormat: "american", // american | decimal | fractional
    // Scales the whole UI, not just type. A token-based control would have
    // been close to a no-op: almost all of this app's sizing is inline pixel
    // values, not var(--fs-*)/var(--s-*), so only the newest code would have
    // responded to it. See UI_SCALE in SettingsModal.
    uiScale: "default", // small | default | large
    timeZone: "auto", // "auto" | an IANA zone name
    reduceMotion: null, // null = follow prefers-reduced-motion
  },
  betting: {
    defaultSport: "auto", // "auto" keeps defaultFeedSport()'s seasonal pick
    sportsbook: "draftkings",
    bankroll: null, // dollars; null = units-only, the pre-existing behavior
    unitSize: 10, // dollars per unit when bankroll mode is "fixed"
    unitMode: "fixed", // fixed | percent
    unitPercent: 1, // percent of bankroll per unit when unitMode is "percent"
    defaultStake: 1, // units
    sampleWindow: "l10", // l5 | l10 | l20 | season
    lean: "over", // over | under
  },
};

// Deep-ish merge, one level into each section. Stored objects are always
// merged *over* DEFAULTS rather than used directly, so a settings key added
// in a later release resolves to its default for existing users instead of
// arriving as undefined and rendering an empty control.
function withDefaults(stored) {
  const out = {};
  for (const section of Object.keys(DEFAULTS)) {
    out[section] = { ...DEFAULTS[section], ...(stored?.[section] || {}) };
  }
  return out;
}

// The accent the app falls back to when the user has never picked one. A
// stored value identical to it means "never chose one" -- the pre-settings
// build wrote this hex into storage on first load whether or not the picker
// was ever opened, and treating it as unset is what lets light mode fall back
// to its own deeper blue (see the :root blocks in index.css).
const LEGACY_DEFAULT_ACCENT = "#2f8cf5";

// One-time read of the pre-settings keys. They are intentionally left in
// place afterwards: they cost a few bytes, and leaving them means rolling
// back to the previous build doesn't drop anyone's theme.
function readLegacy() {
  const out = { display: {}, betting: {} };
  try {
    const theme = localStorage.getItem("propLedgerTheme");
    if (theme === "dark" || theme === "light") out.display.theme = theme;

    const accent = localStorage.getItem("propLedgerAccentColor");
    if (accent && accent.toLowerCase() !== LEGACY_DEFAULT_ACCENT) out.display.accentColor = accent;

    const book = localStorage.getItem("propLedgerSportsbook");
    if (book) out.betting.sportsbook = book;
  } catch {
    // Private-mode Safari throws on localStorage access; defaults are fine.
  }
  return out;
}

function readStored() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    parsed = null;
  }
  // No settings object yet -> first run on this build, so pull anything the
  // previous one saved before falling through to defaults.
  if (!parsed || typeof parsed !== "object") return withDefaults(readLegacy());
  return withDefaults(parsed);
}

const SettingsContext = createContext(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}

// Convenience readers, so a component that only needs one section doesn't
// re-render on changes to the other.
export function useDisplaySettings() {
  return useSettings().display;
}
export function useBettingSettings() {
  return useSettings().betting;
}
// Read on its own because odds are rendered in a handful of places scattered
// deep in the component tree, and threading the format down as a prop from
// the root would touch far more code than it's worth.
export function useOddsFormat() {
  return useSettings().display.oddsFormat;
}

// What one unit is worth in dollars, or null when the user hasn't set a
// bankroll -- which is the default, and the behaviour the Ledger had before
// this setting existed.
//
// Units stay the stored truth everywhere: picks are graded and summed in
// units, and dollars are only ever derived at the point of display. That's
// what keeps an already-settled record correct if the bankroll changes later
// -- the alternative, storing dollars on each pick, would silently restate
// past results every time someone adjusted their unit size.
export function useUnitValue() {
  const { bankroll, unitMode, unitPercent, unitSize } = useSettings().betting;
  if (!bankroll || bankroll <= 0) return null;
  const v = unitMode === "percent" ? (bankroll * unitPercent) / 100 : unitSize;
  return Number.isFinite(v) && v > 0 ? v : null;
}

// "+1.23u", or "+1.23u ($12.30)" once a bankroll is set.
export function formatUnits(u, dollarsPerUnit, { parens = true } = {}) {
  const sign = u >= 0 ? "+" : "−";
  const base = `${sign}${Math.abs(u).toFixed(2)}u`;
  if (!dollarsPerUnit) return base;
  const money = `${sign}$${Math.abs(u * dollarsPerUnit).toFixed(2)}`;
  return parens ? `${base} (${money})` : money;
}

const prefersDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
};

// Resolves theme "auto" against the OS setting, and keeps following it while
// "auto" is selected -- a media-query listener rather than a one-shot read,
// so switching the OS appearance repaints the app without a reload.
function useResolvedTheme(theme) {
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    if (theme !== "auto") return undefined;
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const onChange = (e) => setSystemDark(e.matches);
    // Safari < 14 only has the deprecated addListener form.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    setSystemDark(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [theme]);

  if (theme === "auto") return systemDark ? "dark" : "light";
  return theme === "light" ? "light" : "dark";
}

// Foreground colour for text sitting on a solid --amber background. The
// accent is user-pickable from a full colour wheel (see ColorWheel.jsx), so
// it can land anywhere from near-black to near-white -- a fixed label colour
// is unreadable at one end or the other. Picks whichever of near-black or
// white has the higher WCAG contrast against the given accent.
//
// Moved here from PropLedger.jsx along with the effect that calls it: this
// module has to initialise before that one, so it can't import from it.
const ACCENT_ON_DARK = "#08131c";
const ACCENT_ON_LIGHT = "#ffffff";
function accentForeground(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || "").trim());
  if (!m) return ACCENT_ON_DARK;
  const channel = (c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel(m[1]) + 0.7152 * channel(m[2]) + 0.0722 * channel(m[3]);
  // Relative luminance of ACCENT_ON_DARK is ~0.0057; 1.0 for white.
  const contrastWithDark = (lum + 0.05) / (0.0057 + 0.05);
  const contrastWithWhite = (1.0 + 0.05) / (lum + 0.05);
  return contrastWithDark >= contrastWithWhite ? ACCENT_ON_DARK : ACCENT_ON_LIGHT;
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const initial = readStored();
    // Applied eagerly here rather than only in the effect below so the very
    // first paint already uses the saved theme instead of flashing dark and
    // then correcting to light.
    const t = initial.display.theme;
    const resolved = t === "auto" ? (prefersDark() ? "dark" : "light") : t;
    try {
      document.documentElement.setAttribute("data-theme", resolved);
    } catch {
      // SSR/no-DOM; the effect will cover it.
    }
    return initial;
  });

  const resolvedTheme = useResolvedTheme(settings.display.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // --accent-color drives --amber (and everything derived from it) through a
  // CSS fallback. The property is only ever *set* once the user has actually
  // picked a colour; until then it stays unset so `var(--accent-color, ...)`
  // falls through to the default Lapis in index.css, same in both themes.
  const { accentColor, uiScale, reduceMotion } = settings.display;
  useEffect(() => {
    const root = document.documentElement;
    if (accentColor) root.style.setProperty("--accent-color", accentColor);
    else root.style.removeProperty("--accent-color");
  }, [accentColor]);

  // Keeps --accent-on (the label colour for text on a solid accent fill)
  // matched to whatever --amber actually resolved to. Reads the *resolved*
  // value rather than accentColor so it also covers the unset case, where the
  // two themes fall back to different default blues -- hence the theme
  // dependency. Must stay after the two effects above so it observes the
  // data-theme attribute and --accent-color they've already written.
  useEffect(() => {
    const root = document.documentElement;
    const resolved = getComputedStyle(root).getPropertyValue("--amber");
    root.style.setProperty("--accent-on", accentForeground(resolved));
  }, [accentColor, resolvedTheme]);

  // Zoom on the root element rather than a font-size change, for the reason
  // in DEFAULTS: it scales inline pixel values too, which is nearly all of
  // this app. Fixed-position overlays (the My Picks FAB, the mobile player
  // strip, every drawer) stay correctly anchored under it, and it produces no
  // horizontal overflow -- both checked in the browser before choosing it.
  useEffect(() => {
    document.documentElement.setAttribute("data-ui-scale", uiScale);
  }, [uiScale]);

  const motionOff = reduceMotion === null ? prefersReducedMotion() : reduceMotion;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", motionOff);
  }, [motionOff]);

  // Skips the write on the mount pass, which has nothing new to save -- that
  // would be a synchronous localStorage write on every single page load. Not
  // writing until something changes is safe because readStored() re-runs the
  // legacy migration on each load until a settings object exists.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, ...settings }));
    } catch {
      // Quota or private mode -- the in-memory settings still work for this
      // session, which is a better outcome than crashing the app.
    }
  }, [settings]);

  const value = useMemo(
    () => ({
      ...settings,
      resolvedTheme,
      reduceMotion: motionOff,
      // set("display", "theme", "light")
      set: (section, key, val) =>
        setSettings((cur) => ({ ...cur, [section]: { ...cur[section], [key]: val } })),
      // Merges several keys in one section at once, for controls that move
      // more than one value together (unit mode + its amount).
      patch: (section, partial) =>
        setSettings((cur) => ({ ...cur, [section]: { ...cur[section], ...partial } })),
      resetSection: (section) =>
        setSettings((cur) => ({ ...cur, [section]: { ...DEFAULTS[section] } })),
    }),
    [settings, resolvedTheme, motionOff]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
