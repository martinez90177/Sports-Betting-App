import React from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";

// The watch list, and the two controls that open it.
//
// Watching used to be My Picks under another name -- the same handler, the
// same state -- so "+ Watch" quietly added a leg to the betslip and nothing
// anywhere answered "what am I watching?". Splitting the lists fixed the first
// half; this file is the second, because a follow-list you cannot read back is
// not a follow-list.
//
// Two surfaces, one panel:
//
//   WatchControl   player detail -- toggles THIS prop, and opens the list
//   WatchMenu      the nav bar   -- opens the list, on every page with a nav
//
// The toggle is contextual: it has to be about some particular prop, so it can
// only live where one is on screen. The list is not, which is why the nav gets
// its own control rather than the player page staying the only door to it.
// Alex: "add the watch list to those pages too".
//
// Both render WatchPanel, so there is one description of what a watched prop
// looks like rather than two that drift apart.

const MONO = "'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const LABEL = { fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase" };

// Open/close, click-outside and Escape. Identical for both surfaces, so it is
// written once rather than twice slightly differently.
function useDisclosure() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

// The dropdown itself. Positioned by its wrapper, which both controls make
// `position: relative`.
function WatchPanel({ watched = [], onOpenWatched, onRemoveWatch, onClose, emptyHint }) {
  return (
    <div
      className="pp-watch-panel"
      style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
        width: 330, maxWidth: "calc(100vw - 32px)",
        background: "var(--surface-1)", border: "1px solid var(--line)",
        borderRadius: 6, boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        overflow: "hidden", textAlign: "left",
      }}
    >
      <div style={{ ...LABEL, display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderBottom: "1px solid var(--line)", color: "var(--dim)" }}>
        <span>Watching</span>
        <span style={{ marginLeft: "auto", color: "var(--text)" }}>{watched.length}</span>
      </div>

      {watched.length === 0 ? (
        // Not a bare "empty". The whole point of the change behind this file is
        // that watching and picking are different things, and this is the one
        // surface where saying so costs nothing.
        <div style={{ padding: "16px 14px", fontFamily: MONO, fontSize: 11, lineHeight: 1.65, color: "var(--dim)" }}>
          Nothing watched yet.
          <div style={{ marginTop: 7 }}>{emptyHint}</div>
        </div>
      ) : (
        <div className="pp-watch-list" style={{ maxHeight: 340, overflowY: "auto" }}>
          {watched.map((w) => (
            <div
              key={w.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--line)" }}
            >
              {/* CLAUDE.md rule 1: a named player gets an avatar. No dot on it
                  -- see buildPageWatch in PropLedger for why a stored
                  availability is not availability. */}
              <PlayerAvatar
                name={w.name} alt={w.name} sport={w.sport} team={w.team}
                headshotSrc={w.headshotSrc} fallbackSrc={w.fallbackSrc}
                surface="var(--surface-1)" size={28} inset={2}
              />
              <div
                role="button" tabIndex={0}
                title={`Open ${w.name} — ${w.subtitle || ""}`.trim()}
                onClick={() => { onClose && onClose(); onOpenWatched && onOpenWatched(w); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose && onClose(); onOpenWatched && onOpenWatched(w); } }}
                style={{ minWidth: 0, flex: 1, cursor: onOpenWatched ? "pointer" : "default" }}
              >
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--dim)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[w.team, w.subtitle].filter(Boolean).join(" · ")}
                </div>
              </div>
              {/* The rate it was watched at. Not recomputed -- this list is a
                  bookmark, and the page it opens is where the live number
                  lives. */}
              {w.hitRate != null && (
                <span style={{ flex: "none", fontFamily: MONO, fontSize: 11, color: "var(--dim)" }}>
                  {Math.round(w.hitRate * 100)}%
                </span>
              )}
              <span
                role="button" tabIndex={0}
                title={`Stop watching ${w.name}`}
                onClick={() => onRemoveWatch && onRemoveWatch(w.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemoveWatch && onRemoveWatch(w.id); } }}
                style={{ flex: "none", cursor: "pointer", fontFamily: MONO, fontSize: 13, color: "var(--dim)", padding: "0 2px" }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The player page's control: a toggle for the prop in front of you, with the
// list hanging off it.
//
// Two segments rather than a menu over the whole control, because the common
// action is the toggle and it has to stay one click. The count segment is
// always rendered, empty list included: a control that appears only once it
// has contents cannot teach anyone that it exists.
export function WatchControl({ crumb, watching, onWatch, watched = [], onOpenWatched, onRemoveWatch }) {
  const { open, setOpen, ref } = useDisclosure();

  const seg = {
    ...crumb,
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 10px", whiteSpace: "nowrap", lineHeight: 1,
  };

  return (
    <span ref={ref} className="pp-watch" style={{ justifySelf: "end", position: "relative", display: "inline-flex", alignItems: "stretch" }}>
      <span
        role="button" tabIndex={0} aria-pressed={!!watching}
        title={watching ? "Stop watching this prop" : "Watch this prop — this does not add it to My Picks"}
        onClick={onWatch}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch && onWatch(); } }}
        style={{
          ...seg,
          color: "var(--amber-ink)", cursor: onWatch ? "pointer" : "default",
          border: "1px solid var(--line)", borderRight: "none",
          borderRadius: "4px 0 0 4px",
          background: watching ? "var(--surface-sunken)" : "transparent",
        }}
      >
        {watching ? "✓ Watching" : "+ Watch"}
      </span>
      <span
        role="button" tabIndex={0} aria-expanded={open} aria-haspopup="true"
        title={watched.length ? "See everything you are watching" : "Your watch list — nothing on it yet"}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        style={{
          ...seg,
          cursor: "pointer", gap: 5,
          color: watched.length ? "var(--text)" : "var(--dim)",
          border: "1px solid var(--line)", borderRadius: "0 4px 4px 0",
          background: open ? "var(--surface-sunken)" : "transparent",
        }}
      >
        {watched.length}
        <span style={{ fontSize: 8, color: "var(--dim)" }}>{open ? "▲" : "▼"}</span>
      </span>

      {open && (
        <WatchPanel
          watched={watched}
          onOpenWatched={onOpenWatched}
          onRemoveWatch={onRemoveWatch}
          onClose={() => setOpen(false)}
          // On this page the pick button is a few inches down the same column,
          // so the hint can point at it.
          emptyHint="Watching a prop keeps it here to check on. It does not put it on your My Picks slip — that is the button under the chart."
        />
      )}
    </span>
  );
}

// The nav bar's control: no toggle, because the nav is not about any one prop.
// Sized and bordered like the cog beside it so the right-hand group stays one
// row of equal weights rather than a button and a pill.
//
// Rendered at zero as well, for the same reason the player page's count is:
// the list is new, and a door that only appears once you are already inside is
// not a door. It dims instead.
export function WatchMenu({ watched = [], onOpenWatched, onRemoveWatch }) {
  const { open, setOpen, ref } = useDisclosure();
  const n = watched.length;

  return (
    <span ref={ref} className="pp-nav-watch" style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-expanded={open} aria-haspopup="true"
        aria-label={n ? `Watching — ${n} prop${n === 1 ? "" : "s"}` : "Watch list — nothing on it yet"}
        title={n ? "See everything you are watching" : "Your watch list — nothing on it yet"}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          height: 32, minHeight: "var(--tap, 32px)", padding: "0 11px",
          borderRadius: 8, border: "1px solid var(--line)",
          background: open ? "var(--surface-sunken)" : "var(--panel2)",
          color: n ? "var(--text)" : "var(--dim)",
          cursor: "pointer",
          ...LABEL,
        }}
      >
        {/* The word goes first and hides on a phone (.pp-nav-watchword), the
            same trade the SIGN IN mark makes: at 390px the top row cannot hold
            the wordmark, this, the cog and the 21+ mark, and the count is the
            half that carries the information. */}
        <span className="pp-nav-watchword">Watching</span>
        <span style={{ color: n ? "var(--amber-ink)" : "var(--dim)" }}>{n}</span>
      </button>

      {open && (
        <WatchPanel
          watched={watched}
          onOpenWatched={onOpenWatched}
          onRemoveWatch={onRemoveWatch}
          onClose={() => setOpen(false)}
          // No "the button under the chart" here: from the nav there is no
          // chart on screen to point at.
          emptyHint="Open a player and press + Watch to keep a prop here. Watching is not the same as My Picks — nothing you watch goes on your slip."
        />
      )}
    </span>
  );
}
