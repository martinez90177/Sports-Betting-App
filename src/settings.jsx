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
    // Which page the app opens on, and where the wordmark goes -- the
    // wordmark never returns to the intro, which is first-run only (see
    // TOUR_STORAGE_KEY below).
    //
    // Defaults to "feed", which is what the app opens on today, so adding
    // this preference moves nobody. The newcomer problem -- "what is this
    // and where do I start" -- is the intro's job, and relocating the daily
    // user's start page does not help a newcomer while costing a returning
    // user the habit they already have. Two different problems.
    //
    // Specified in docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md as one of two new
    // display prefs; the other, "compact rows", belongs to that track and is
    // deliberately not added here. Values are page ids from PageNavDropdown:
    // landing | feed | games | board | nfl | mlb | nba | wnba | news.
    startPage: "feed",
    // Outcome colours, user-settable independently of the accent, for
    // readers who cannot separate the default green/red pair. Offered as
    // *pairs* rather than two free pickers: two independent wheels let
    // someone choose hues 15 degrees apart and break every graph in the app,
    // and a pair can be checked as a pair. posColor/negColor stay null
    // unless someone overrides a preset with the wheels.
    //
    // Availability is deliberately NOT affected by this -- see the status
    // block in index.css. A palette preference must not retint injury status.
    statusPalette: "green-red", // green-red | blue-orange | teal-magenta | high-contrast | no-hue
    posColor: null,
    negColor: null,
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

// --------------------------------------------------------------------------
// Outcome colours
// --------------------------------------------------------------------------
// Offered as *pairs*, never as two independent pickers. Two free wheels let
// someone choose hues fifteen degrees apart and break every graph in the app
// at once, and a pair can be checked as a pair before it ships. The wheels
// exist (posColor/negColor) for anyone who needs a specific hue, but they
// start from a preset rather than from nothing.
//
// Availability deliberately does not follow this -- see the status block in
// index.css. A palette preference must not retint injury status.
export const STATUS_PALETTES = [
  { id: "green-red", label: "Green / red", pos: "#3ecf8e", neg: "#ef5b5b", note: "The default." },
  { id: "blue-orange", label: "Blue / orange", pos: "#4c9ff0", neg: "#e8823a", note: "The usual choice for red-green colour blindness." },
  { id: "teal-magenta", label: "Teal / magenta", pos: "#2bb8a6", neg: "#d6409f", note: "Furthest apart in hue of the coloured pairs." },
  { id: "high-contrast", label: "High contrast", pos: "#ffffff", neg: "#7a8291", note: "Maximum separation by lightness rather than hue." },
  { id: "no-hue", label: "No hue", pos: "#e8ecf2", neg: "#8b98ab", note: "Shape alone: fill cleared, outline fell short." },
];

export function statusPaletteById(id) {
  return STATUS_PALETTES.find((p) => p.id === id) || STATUS_PALETTES[0];
}

// Hue distance in degrees, 0-180. Used only for the collision warning, which
// names a problem rather than blocking a choice -- fill versus outline still
// carries cleared/fell-short at any hue, so a close pair is a bad idea and
// not a broken one.
function hueOf(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  // Greys have no hue to compare, so they never collide with anything --
  // which is exactly why the no-hue and high-contrast presets are safe.
  //
  // Measured as HSL *saturation*, not raw channel spread. A raw-delta test
  // called #8b98ab hued at 217 degrees, near enough to Lapis that picking the
  // "no hue" preset -- whose entire purpose is having no hue -- warned about
  // colliding with the accent. A warning that fires on the accessibility
  // option is worse than no warning, because it teaches people to ignore it.
  // Two guards, because neither alone is enough. HSL saturation catches a
  // mid-lightness grey like #8b98ab (raw spread 0.13, saturation 0.16), but
  // it blows up near white and black where its denominator collapses --
  // #e8ecf2 has a raw spread of 0.04 and still computes 0.28. Raw chroma
  // catches that case. Between them, every grey in the presets reads as
  // hueless and every real colour keeps its hue.
  const l = (mx + mn) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.25 || d < 0.1) return null;
  let x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return x * 60;
}

export function hueGap(a, b) {
  const ha = hueOf(a), hb = hueOf(b);
  if (ha == null || hb == null) return null;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d);
}

// The two collisions worth warning about: the outcome pair too close to each
// other, or the accent too close to either outcome. Returns a sentence naming
// what is wrong, or null.
export function paletteWarning(pos, neg, accent) {
  const pair = hueGap(pos, neg);
  if (pair != null && pair < 40) {
    return `Cleared and fell short are ${Math.round(pair)}° apart. They will be hard to tell apart in a graph — fill and outline still separate them, but colour will not.`;
  }
  const toPos = hueGap(accent, pos);
  const toNeg = hueGap(accent, neg);
  const near = toPos != null && toPos < 25 ? "cleared" : toNeg != null && toNeg < 25 ? "fell short" : null;
  if (near) {
    return `Your accent is close to the ${near} colour. The accent means "selected", so a selected control could read as an outcome.`;
  }
  return null;
}

// --------------------------------------------------------------------------
// First-run state
// --------------------------------------------------------------------------
// Separate from propPalaceSettings on purpose: this is not a preference, it
// is a record of whether someone has been here before, and the guided tour
// will keep its progress in the same object.
//
// The shape is `{ step, completed, dismissed }`, specified in
// docs/ACCOUNTS_SUBSCRIPTION_TUTORIAL.md. Only `dismissed` is read or written
// here -- `step` and `completed` belong to the tutorial track, which has not
// started. Writes therefore *merge* rather than replace, so when that track
// lands it can add its own fields without this code overwriting them, and
// vice versa.
//
// It lives in localStorage rather than memory because the requirement is
// "once ever, per browser": clearing site data legitimately resets it, and a
// reload must not re-prompt.
export const TOUR_STORAGE_KEY = "propPalaceTour";

export function readTourState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Private-mode Safari throws on localStorage access. Treating that as
    // "never seen" shows the intro every time, which is the harmless side to
    // fail on -- the alternative hides an onboarding screen from someone who
    // has never seen it.
  }
  return {};
}

// True only for someone who has never dismissed the intro.
export function isFirstRun() {
  return readTourState().dismissed !== true;
}

// Flipped when someone actually opens the board, not when the intro renders.
// Dismissing on render would spend the one-time prompt on a bounce -- a
// first-time visitor who reloads before engaging has still not seen it.
export function markTourDismissed() {
  try {
    const next = { ...readTourState(), dismissed: true };
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do -- the intro will show again next load.
  }
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

  // Outcome colours. Written as --green/--red rather than --pos/--neg because
  // those are what index.css derives from: --pos, --neg, --pos-dim and
  // --pos-solid all resolve through them, so one write re-tints every bar,
  // rate cell and caption together and none of them can drift apart.
  //
  // Only ever *set* when the user has moved away from the default pair, so
  // the stylesheet's own per-theme values keep working -- light mode's green
  // is a deeper #1f9d68 than dark's, and hardcoding the dark hex here would
  // flatten that distinction for everyone who never opened this control.
  const { statusPalette, posColor, negColor } = settings.display;
  useEffect(() => {
    const root = document.documentElement;
    const preset = statusPaletteById(statusPalette);
    const pos = posColor || preset.pos;
    const neg = negColor || preset.neg;
    const isDefault = statusPalette === STATUS_PALETTES[0].id && !posColor && !negColor;
    if (isDefault) {
      root.style.removeProperty("--green");
      root.style.removeProperty("--red");
    } else {
      root.style.setProperty("--green", pos);
      root.style.setProperty("--red", neg);
    }
  }, [statusPalette, posColor, negColor]);

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
