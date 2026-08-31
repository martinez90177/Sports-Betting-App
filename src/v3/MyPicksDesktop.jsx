import React from "react";
import NavBar from "../NavBar.jsx";
import PlayerAvatar from "../PlayerAvatar.jsx";
import { crest } from "./FormPlot.jsx";
import { INTENTS, TARGETS, fmtAmerican } from "./intentRead.js";
import useMyPicks from "./useMyPicks.js";

// A transcription of frame `2a` in `v3 Mocks/PropPalace Desktop v3.dc.html`.
//
// The desktop My Picks is slip *beside* read, not slip then read: two tabs on
// the left — SLIP and LEDGER — and THE READ as a permanent 404px column that
// never goes away. The phone frame stacks the same three as tabs because it
// has one column to work with; here the read is meant to be visible while the
// slip is being edited, which is the whole point of the width.
//
// Everything it derives comes from `useMyPicks`, shared with the phone frame:
// the same five intents, the same target ladder, the same per-leg flags, the
// same combined number, the same ledger filters. Two derivations would be two
// answers to "is this leg AGAINST".

const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

// One template for the slip header and every slip row, so the columns share
// edges rather than lining up by luck (`desktop-handoff.md` §1).
const SLIP_COLS = "38px minmax(0, 1fr) 84px 1px 116px 92px 34px";
const LEDGER_COLS = "74px minmax(0, 1fr) 120px 110px";

const micro = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" };

// The three flags, and only three. FITS / CHECK / AGAINST — a leg is never
// unflagged, because "we have nothing to say about this" is itself one of the
// three and gets said.
const FLAG_TONE = {
  FITS: { fg: "var(--pos)", bg: "var(--pos-dim)" },
  CHECK: { fg: "var(--status-questionable)", bg: "rgba(232,177,58,0.16)" },
  AGAINST: { fg: "var(--neg)", bg: "var(--neg-dim)" },
};

function flagChip(flag) {
  const t = FLAG_TONE[flag] || FLAG_TONE.CHECK;
  return {
    fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", padding: "3px 7px",
    borderRadius: 5, background: t.bg, color: t.fg, whiteSpace: "nowrap",
  };
}

function pickBtn(on) {
  return {
    minHeight: 34, display: "flex", alignItems: "center", padding: "0 11px",
    borderRadius: 8, fontFamily: MONO, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
    background: on ? "var(--amber-dim)" : "var(--surface-1)",
    color: on ? "var(--amber-ink)" : "var(--text-2)",
  };
}

export default function MyPicksDesktop({
  legs = [],
  settled = [],
  calibration = null,
  correlationGroups = [],
  bookLabel = "DraftKings",
  bookHref = null,
  onRemove,
  onClear,
  onOpenProp,
  combinedOdds = null,
  // The frame draws the app's nav inside itself. My Picks is not one of the
  // six nav tabs — it is reached from the slip dock — so NAV_PAGES excludes it
  // and no NavBar renders above this page; this one renders its own, from the
  // same component every other screen uses.
  onNavigate,
  // The way out. My Picks is not a nav tab, so nothing in the row can be
  // highlighted to say where you are -- this is stated instead.
  onBack = null,
  backLabel = null,
  onHome,
  onOpenSettings,
}) {
  const {
    calLine, tab, setTab, intent, intentId, setIntentId, target, setTarget,
    ledgerFilter, setLedgerFilter,
    view, combinedRate, read, moves, short, am,
    ledgerRows, ledgerCount,
  } = useMyPicks({ legs, settled, correlationGroups, combinedOdds, calibration });

  // Fills what is left under the nav, measured rather than assumed — the same
  // note as PropFeedDesktop.
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

  const bad = read.filter((r) => r.flag === "AGAINST").length;
  const check = read.filter((r) => r.flag === "CHECK").length;
  const readCount = bad || check
    ? `${bad ? `${bad} against` : ""}${bad && check ? " · " : ""}${check ? `${check} to check` : ""}`
    : `all ${read.length} fit`;

  const article = /^[aeiou]/i.test(intent.label) ? "an" : "a";
  const kind = intent.label.toLowerCase();
  const readHeadline = read.length === 0
    ? "Nothing on the slip yet. The read fills in as legs are added."
    : bad
      ? `${bad} ${bad === 1 ? "leg works" : "legs work"} against ${article} ${kind} build. ${intent.against}`
      : check
        ? `Nothing here contradicts ${article} ${kind} build, but ${check} ${check === 1 ? "leg needs" : "legs need"} a look before it settles.`
        : `Every leg fits ${article} ${kind} build.`;

  // The combined number is these rates multiplied, and it is labelled as
  // exactly that. It is not a price and no book priced it.
  const readPrice = combinedRate == null
    ? "No combined number — a leg on the slip has no counted rate behind it."
    : `${Math.round(combinedRate * 100)}% together from these rates · ${fmtAmerican(am)}`
      + (short ? ` · under your +${target} target` : ` · at or past your +${target} target`)
      + " · no book priced this";

  const avatarFor = (l, size) => (
    <PlayerAvatar
      name={l.name} alt={l.name} sport={l.sport} team={l.team}
      headshotSrc={l.avatar} fallbackSrc={l.avatarFallback}
      size={size} inset={2} status={l.avail || undefined} surface="var(--surface-1)"
    />
  );

  const tabs = ["Slip", "Ledger"];

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
      {/* ---- nav row -----------------------------------------------------
          The real NavBar, not a copy of it. The copy that used to sit here
          drew its tabs in `--dim` where NavBar uses `--text-2`, and reserved
          no underline, so on the one screen where no tab is ever active this
          row read as a static header rather than as navigation. Alex: "there
          is no way to get back to prop feed or any other page after hitting
          full view."

          `page={null}` is honest -- My Picks is not one of the six tabs -- so
          the way out is stated explicitly beside the cog instead of being left
          to a highlight that can never appear. */}
      <NavBar
        page={null}
        onNavigate={onNavigate}
        onHome={onHome}
        onOpenSettings={onOpenSettings}
        extraRight={onBack ? (
          <span
            role="button"
            tabIndex={0}
            onClick={onBack}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack(); } }}
            title="Leave the slip"
            style={{
              display: "flex", alignItems: "center", gap: 7, minHeight: 32, padding: "0 12px",
              borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-1)",
              color: "var(--amber-ink)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {backLabel ? `← ${backLabel.toUpperCase()}` : "← BACK"}
          </span>
        ) : null}
      />

      {/* ---- tabs, intent, target ---------------------------------------- */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 20, padding: "14px 32px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7 }}>
          {tabs.map((label) => {
            const on = tab === label;
            const n = label === "Slip" ? view.length : settled.length;
            return (
              <div
                key={label}
                role="button"
                tabIndex={0}
                onClick={() => setTab(label)}
                onKeyDown={(e) => { if (e.key === "Enter") setTab(label); }}
                style={{ ...pickBtn(on), gap: 7 }}
              >
                {label.toUpperCase()}
                <span style={{ fontFamily: MONO, fontSize: 10, padding: "1px 6px", borderRadius: 999, background: on ? "var(--amber)" : "var(--surface-2)", color: on ? "var(--accent-on)" : "var(--dim)" }}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>
        <span style={micro}>BUILDING</span>
        <div style={{ display: "flex", gap: 7 }}>
          {INTENTS.map((it) => (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              title={it.hint}
              onClick={() => setIntentId(it.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setIntentId(it.id); }}
              style={pickBtn(intentId === it.id)}
            >
              {it.label}
            </div>
          ))}
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
          <span style={micro}>TARGET</span>
          {TARGETS.map((v) => (
            <div
              key={v}
              role="button"
              tabIndex={0}
              onClick={() => setTarget(v)}
              onKeyDown={(e) => { if (e.key === "Enter") setTarget(v); }}
              style={pickBtn(target === v)}
            >
              {`+${v}`}
            </div>
          ))}
        </span>
      </div>

      {/* ---- slip/ledger beside the read -------------------------------- */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr) 404px" }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>

          {tab === "Slip" && (
            <>
              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", gap: 12, padding: "12px 24px" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {`${view.length} ${view.length === 1 ? "leg" : "legs"} · reading against ${article} ${kind} build`}
                </span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>{intent.hint}</span>
              </div>

              <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: SLIP_COLS, alignItems: "center", columnGap: 14, padding: "10px 24px", background: "var(--surface-1)", borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: "var(--dim)" }}>
                <span />
                <span>LEG</span>
                <span style={{ textAlign: "right" }}>YOUR RATE</span>
                <span />
                <span style={{ textAlign: "right" }}>IMPLIED</span>
                <span style={{ textAlign: "center" }}>READ</span>
                <span />
              </div>

              <div style={{ flex: "0 0 auto", padding: "9px 24px", background: "var(--surface-1)", borderBottom: "1px solid #20242b" }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.5, color: "var(--dim)" }}>
                  {`IMPLIED is each leg's own hit rate converted to odds — not a sportsbook price. ${bookLabel} is only where the slip opens.`}
                </span>
              </div>

              <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
                {view.map((l, i) => {
                  const r = read[i];
                  return (
                    <div key={l.id} style={{ display: "grid", gridTemplateColumns: SLIP_COLS, alignItems: "center", columnGap: 14, padding: "13px 24px", borderBottom: "1px solid #20242b" }}>
                      <span style={{ position: "relative" }}>{avatarFor(l, 38)}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpenProp && onOpenProp(l)}
                            onKeyDown={(e) => { if (e.key === "Enter") onOpenProp && onOpenProp(l); }}
                            style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: onOpenProp ? "pointer" : "default" }}
                          >
                            {l.name}
                          </span>
                          {l.team && <span role="img" style={crest(l.team, l.sport, 15)} />}
                          {/* ALT means off the posted line, not "you changed
                              it" — the posted line rides along on the pick. */}
                          {l.alt && (
                            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", padding: "2px 5px", borderRadius: 4, background: "var(--amber-dim)", color: "var(--amber-ink)" }}>ALT</span>
                          )}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.prop}</span>
                        {l.opp && (
                          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{l.opp}</span>
                        )}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: l.rate == null ? "var(--dim)" : l.rate >= 0.7 ? "var(--pos)" : "var(--text)" }}>
                          {l.rate == null ? "—" : `${Math.round(l.rate * 100)}%`}
                        </span>
                        {/* The sample, beside the rate and counted from the
                            same array — never one without the other. */}
                        <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>
                          {l.n ? `${l.hits} of ${l.n}` : "no sample"}
                        </span>
                      </span>
                      <span style={{ width: 1, alignSelf: "stretch", background: "#20242b", display: "block", justifySelf: "center" }} />
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{ fontFamily: MONO, fontSize: 13, color: l.odds == null ? "var(--dim)" : "var(--text)" }}>
                          {l.odds == null ? "—" : fmtAmerican(l.odds)}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)" }}>
                          {l.odds == null ? "no rate to convert" : "from this rate"}
                        </span>
                      </span>
                      <span style={{ display: "flex", justifyContent: "center" }}>
                        {r && <span style={flagChip(r.flag)}>{r.flag}</span>}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => onRemove && onRemove(l.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") onRemove && onRemove(l.id); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dim)", fontSize: 16, cursor: "pointer" }}
                      >
                        ×
                      </span>
                    </div>
                  );
                })}
                {view.length === 0 && (
                  <div style={{ padding: "26px 24px", fontSize: 13, lineHeight: 1.6, color: "var(--dim)" }}>
                    Nothing on the slip. Add a leg from the feed&apos;s + button or a player page. Watching a prop does not put it here — those are two lists on purpose.
                  </div>
                )}
              </div>

              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 18, padding: "14px 24px", borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {[
                    ["FITS", "nothing counted argues against it"],
                    ["CHECK", "something to look at before it settles"],
                    ["AGAINST", "a counted fact points the other way"],
                  ].map(([label, means]) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={flagChip(label)}>{label}</span>
                      <span style={{ fontSize: 12, color: "var(--dim)", whiteSpace: "nowrap" }}>{means}</span>
                    </span>
                  ))}
                </div>
                {view.length > 0 && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={onClear}
                    onKeyDown={(e) => { if (e.key === "Enter") onClear && onClear(); }}
                    style={{ minHeight: 36, display: "flex", alignItems: "center", padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", color: "var(--dim)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer" }}
                  >
                    CLEAR
                  </div>
                )}
                <a
                  href={bookHref || undefined}
                  target={bookHref ? "_blank" : undefined}
                  rel={bookHref ? "noreferrer" : undefined}
                  style={{
                    marginLeft: "auto", minHeight: 44, display: "flex", alignItems: "center", gap: 9,
                    padding: "0 18px", borderRadius: 10, border: "1px solid var(--amber)",
                    background: "var(--amber)", color: "var(--accent-on)", textDecoration: "none",
                    fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.08em",
                    opacity: bookHref ? 1 : 0.5, pointerEvents: bookHref ? "auto" : "none",
                  }}
                >
                  {`OPEN IN ${bookLabel} →`}
                </a>
              </div>
            </>
          )}

          {tab === "Ledger" && (
            <>
              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 14, padding: "12px 24px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {(() => {
                    const graded = settled.filter((p) => p.result === "won" || p.result === "lost");
                    return `${graded.filter((p) => p.result === "won").length} of ${graded.length} settled picks cleared`;
                  })()}
                </span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                  {["All", "Won", "Lost", "Open"].map((label) => (
                    <div
                      key={label}
                      role="button"
                      tabIndex={0}
                      onClick={() => setLedgerFilter(label)}
                      onKeyDown={(e) => { if (e.key === "Enter") setLedgerFilter(label); }}
                      style={{ ...pickBtn(ledgerFilter === label), gap: 6, minHeight: 30, fontSize: 11 }}
                    >
                      {label}
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--dim)" }}>{ledgerCount(label)}</span>
                    </div>
                  ))}
                </span>
              </div>
              <div className="nsb" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
                {ledgerRows.map((r) => (
                  <div key={r.id} style={{ display: "grid", gridTemplateColumns: LEDGER_COLS, alignItems: "center", columnGap: 14, padding: "12px 24px", borderBottom: "1px solid #20242b" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>{r.gameDate || "—"}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</span>
                      {r.team && <span role="img" style={crest(r.team, r.sport, 13)} />}
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subtitle}</span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--dim)" }}>
                      {r.hitRate == null ? "unrated" : `claimed ${Math.round(r.hitRate * 100)}%`}
                    </span>
                    <span style={{ display: "flex", justifyContent: "flex-end" }}>
                      <span style={flagChip(r.result === "won" ? "FITS" : r.result === "lost" ? "AGAINST" : "CHECK")}>
                        {String(r.result || "open").toUpperCase()}
                      </span>
                    </span>
                  </div>
                ))}
                {ledgerRows.length === 0 && (
                  <div style={{ padding: "26px 24px", fontSize: 13, color: "var(--dim)" }}>
                    Nothing settled under this filter yet.
                  </div>
                )}
              </div>
              <div style={{ flex: "0 0 auto", padding: "13px 24px", borderTop: "1px solid var(--line)", fontSize: 12, lineHeight: 1.5, color: "var(--dim)" }}>
                A pick settles when its game finishes. Nothing here is graded by hand, and an open pick is never counted as a win.
              </div>
            </>
          )}
        </div>

        {/* ---- THE READ, a permanent column ----------------------------- */}
        <div className="nsb" style={{ borderLeft: "1px solid var(--line)", overflowY: "auto", padding: "20px 20px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-1)", padding: 15, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, display: "block", flex: "0 0 auto", background: bad ? "var(--neg)" : check ? "var(--status-questionable)" : "var(--pos)" }} />
              <span style={micro}>THE READ</span>
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--dim)" }}>{readCount}</span>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)", textWrap: "pretty" }}>{readHeadline}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, color: "var(--amber-ink)" }}>{readPrice}</span>
          </div>

          {read.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={micro}>WHAT THE FLAGS REST ON</span>
              {read.map((r) => (
                <div key={r.key} style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={flagChip(r.flag)}>{r.flag}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto" }}>{r.name}</span>
                  </div>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>{r.say}</span>
                  {/* No objection without a counted fact — every say carries
                      the cite it rests on. */}
                  <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.45, color: "var(--dim)" }}>{r.cite}</span>
                </div>
              ))}
            </div>
          )}

          {moves.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={micro}>WHAT WOULD CHANGE IT</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {moves.map((m) => (
                  <div key={m.title} style={{ display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-1)", padding: "11px 13px" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</span>
                      <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--dim)" }}>{m.why}</span>
                    </span>
                    {m.action && (
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber-ink)", whiteSpace: "nowrap", flex: "0 0 auto" }}>{m.action}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)", padding: "13px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={micro}>DID YOUR RATES HOLD</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text-2)" }}>{calLine}</span>
          </div>

          <span style={{ fontSize: 11.5, lineHeight: 1.55, color: "var(--dim)" }}>
            Every line here cites something counted — a sample, a split, a lineup, a defence rank. Nothing predicts a game, and no objection is raised without a fact behind it.
          </span>
        </div>
      </div>
    </div>
  );
}
