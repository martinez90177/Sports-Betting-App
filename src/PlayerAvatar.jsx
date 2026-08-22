import React, { useState, useEffect } from "react";
import { avatarBackgroundFor, STATUS } from "./lib/teamColors.js";

// Circular player avatar: team-colour gradient background, headshot on top,
// optional availability dot bottom-right. Initials render only when there is
// no photo left to try.
//
// This is the one avatar in the app -- NFL, NBA, MLB and WNBA all render
// through it. Two things it does that the original handoff component did not,
// because the app already relied on both:
//
//   * Colours come from the sport's own brand map (`sport` or an explicit
//     `colorMap`), not a single NFL table. Abbreviations collide across
//     leagues, so the sport has to be part of the lookup.
//   * `src` is a chain, not a single URL. Every sport has a primary photo CDN
//     and most have a fallback (ESPN combiner crops behind MLB's midfield
//     CDN, NBA's CDN behind ESPN); a 404 walks to the next one and only then
//     falls through to the gradient.
//
// On `status`: the dot is rendered only when a caller passes a real status.
// Today that is the MLB pages, where availability comes from the MLB Stats API
// active roster. The other sports have no player-level availability feed, and
// a green dot on every one of them would be decoration standing in for data.
// Pass a status there once there is something real behind it.
export default function PlayerAvatar({
  name = "",
  team,
  sport = "nfl",
  colorMap,                  // overrides `sport` when the caller already has a map
  background,                // overrides both when the caller precomputed the gradient
  espnId,
  headshotSrc,
  fallbackSrc,
  status,                    // "active" | "questionable" | "out" -- omit when unknown
  lineup,                    // "posted" | "projected" -- omit when unknown
  size = 52,
  ringColor,
  surface = "var(--panel)",  // colour the status-dot border punches through
  dimmed = false,            // unavailable players stay visible but demoted
  inset = 0,                 // see note below
  shadow,
  backing,                   // solid disc under the photo -- see note below
  fadeIn = false,
  imgBorder,
  alt = "",
  style,
}) {
  // `inset` insets the photo inside the gradient disc so the gradient itself
  // reads as a ring, rather than drawing a border on top. The roster rails and
  // lineup drawer use it because some official photos are plain white-backdrop
  // studio shots that would otherwise cover the team colour edge to edge and
  // leave that one player looking unlike the rest of the roster.
  const inner = size - inset * 2;

  // Tight combiner crop rather than the raw "full" asset, which carries a lot
  // of jersey and background and reads badly in a circle.
  const espnUrl = espnId
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/${sport}/players/full/${espnId}.png&w=350&h=350&scale=crop`
    : null;
  const chain = [headshotSrc, fallbackSrc, espnUrl].filter(Boolean);

  const [failed, setFailed] = useState(0);
  // A new player in the same slot (virtualised rows, the player selector)
  // has to start its chain over, or it inherits the previous player's
  // exhausted-source state and shows initials over the gradient.
  useEffect(() => { setFailed(0); }, [chain.join("|")]);

  const src = chain[failed] || null;

  // `backing` paints a solid disc between the gradient and the photo, so an
  // image the browser never fetches -- ad-block and privacy extensions block
  // sports-CDN requests fairly often -- still leaves an on-brand circle rather
  // than a flat black hole. Only worth it on the large header avatars. The
  // fade resets per source so walking to a fallback fades in too.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [src]);

  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  const dotSize = Math.max(9, Math.round(size * 0.27));
  const dotBorder = size >= 60 ? 3 : 2;
  const st = STATUS[status];

  // Lineup state rides the ring, not the corner dot.
  //
  // The v2 Player Detail mock draws lineup state in the bottom-right corner,
  // which is the slot CLAUDE.md rule 3 reserves for availability -- and its
  // "posted" green sits a few points off the availability green, so the two
  // would be read as the same claim. Availability keeps the corner because it
  // is the fact all four leagues report; posted-vs-projected lineups exist
  // only in MLB, and carving an exception into an invariant for one sport's
  // rail is the worse trade.
  //
  // Same fill/hollow/absent device the design uses everywhere, moved to a
  // different element: solid ring posted, dashed ring projected, no ring
  // unknown -- never assumed. Deliberately *not* an outcome or availability
  // hue: those are the reader's to re-tint (see --status-* in index.css), and
  // a lineup that changed colour with the outcome palette would be a bug.
  const lineupRing = lineup === "posted"
    ? { width: 2, style: "solid", color: "var(--text-2)" }
    : lineup === "projected"
    ? { width: 2, style: "dashed", color: "var(--dim)" }
    : null;

  return (
    <span style={{ position: "relative", flexShrink: 0, width: size, height: size, display: "inline-block", ...style }}>
      <span
        className="pp-mono"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, borderRadius: "50%", overflow: "hidden",
          position: "relative", boxSizing: "border-box",
          // The team gradient, with one scrim added only when the disc is
          // showing initials. The gradient is tuned so the *ring* clears the
          // page (see teamAvatarBackground), which on dark mode means a
          // lighter disc -- and a lighter disc is the wrong ground for
          // near-white letters. A photo covers the disc, so the scrim would be
          // pure loss there; initials are the one state that needs it. Worst
          // stop measured: 1.70:1 against --text without this, 4.60:1 with.
          background: src
            ? (background || avatarBackgroundFor({ colorMap, sport, team }))
            : `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), ${background || avatarBackgroundFor({ colorMap, sport, team })}`,
          border: lineupRing
            ? `${lineupRing.width}px ${lineupRing.style} ${lineupRing.color}`
            : inset ? "none" : `2px solid ${ringColor || "var(--line)"}`,
          boxShadow: shadow,
          fontSize: Math.max(9, Math.round(size * 0.25)),
          color: "var(--text)", letterSpacing: "0.02em",
          filter: dimmed ? "grayscale(0.6)" : "none",
          opacity: dimmed ? 0.75 : 1,
        }}
      >
        {backing && (
          <span style={{
            position: "absolute", left: inset, top: inset, width: inner, height: inner,
            borderRadius: "50%", background: backing, border: imgBorder,
          }} />
        )}
        {!src && !backing && initials}
        {src && (
          <img
            key={src}
            src={src}
            alt={alt}
            width={inner}
            height={inner}
            referrerPolicy="no-referrer"
            style={{
              position: "absolute", left: inset, top: inset,
              width: inner, height: inner,
              borderRadius: "50%", objectFit: "cover",
              objectPosition: inset ? "center top" : "top center",
              border: imgBorder,
              opacity: fadeIn && !loaded ? 0 : 1,
              transition: fadeIn ? "opacity 0.15s ease" : undefined,
            }}
            // `ref` as well as onLoad: an image already in the browser cache
            // can finish decoding before React attaches the handler, so onLoad
            // never fires and a `fadeIn` avatar stays at opacity 0 forever --
            // a black hole where the photo is, because `backing` paints under
            // it. Seen on the NFL page, whose headshots were already cached by
            // the v1 render. Checking `complete` at attach covers that race;
            // onLoad still covers the normal cold fetch.
            ref={(el) => { if (el && el.complete && el.naturalWidth) setLoaded(true); }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed((n) => n + 1)}
          />
        )}
      </span>
      {st && (
        <span
          title={st.label}
          style={{
            position: "absolute", right: -1, bottom: -1, width: dotSize, height: dotSize,
            borderRadius: "50%", background: st.dot,
            border: `${dotBorder}px solid ${surface}`, boxSizing: "border-box",
          }}
        />
      )}
    </span>
  );
}

export function StatusPill({ status, note }) {
  const st = STATUS[status];
  if (!st) return null;
  return (
    <span
      className="pp-mono"
      style={{
        fontSize: 10.5, letterSpacing: "0.1em", color: st.dot,
        border: `1px solid ${st.border}`, padding: "5px 9px", whiteSpace: "nowrap",
      }}
    >
      {note ? `${st.label} · ${note}` : st.label}
    </span>
  );
}
