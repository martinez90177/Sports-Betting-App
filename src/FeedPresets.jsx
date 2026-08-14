import React, { useEffect, useMemo, useState } from "react";
import { useOverlay } from "./useOverlay.js";
import {
  loadPresets, savePresets, newPresetId,
  describePreset, filtersEqual, encodeShareLink,
} from "./presets.js";

// --------------------------------------------------------------------------
// Saved screens
// --------------------------------------------------------------------------
// The Prop Feed's filters reset every time the page unmounts, which is every
// time you open a player and come back. This is the fix: name a set of
// filters, save it, reapply it in one tap -- and mark one as the default so
// the feed opens on it.
//
// Shaped after Outlier's Current Filters / Templates modal, with one addition
// they don't have: the primary button carries the live result count, so you
// can see a filter is too tight before committing to it.
const Z_BACKDROP = 3590;
const Z_DIALOG = 3600;

function Chip({ k, v }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, padding: "3px 8px", borderRadius: "var(--r-sm, 4px)",
        background: "var(--surface-2, var(--panel2))", border: "1px solid var(--line)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "var(--dim)" }}>{k}</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{v}</span>
    </span>
  );
}

function PresetCard({
  preset, isApplied, isDefault, describeArgs,
  onApply, onRename, onDelete, onSetDefault, onShare, sharedJustNow,
}) {
  const chips = describePreset(preset.filters, describeArgs);
  return (
    <div
      style={{
        border: `1px solid ${isApplied ? "var(--amber)" : "var(--line)"}`,
        borderRadius: "var(--r-lg, 10px)",
        background: "var(--surface-1, var(--panel))",
        marginBottom: 10, overflow: "hidden",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onApply}
        onKeyDown={(e) => { if (e.key === "Enter") onApply(); }}
        style={{ padding: "12px 14px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="oswald" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {preset.name}
          </span>
          {isDefault && (
            <span className="oswald" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 999, padding: "1px 7px" }}>
              DEFAULT
            </span>
          )}
          <span style={{ marginLeft: "auto", color: "var(--dim)", fontSize: 15, flexShrink: 0 }}>›</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {chips.map((c) => <Chip key={c.k + c.v} k={c.k} v={c.v} />)}
        </div>
      </div>
      <div style={{ display: "flex", borderTop: "1px solid var(--line)" }}>
        {[
          { label: sharedJustNow ? "Copied" : "Share", fn: onShare },
          { label: isDefault ? "Unset default" : "Set default", fn: onSetDefault },
          { label: "Rename", fn: onRename },
          { label: "Delete", fn: onDelete, danger: true },
        ].map((a, i) => (
          <div
            key={a.label}
            role="button"
            tabIndex={0}
            onClick={a.fn}
            onKeyDown={(e) => { if (e.key === "Enter") a.fn(); }}
            style={{
              flex: 1, textAlign: "center", padding: "8px 4px", cursor: "pointer",
              fontSize: 11, fontWeight: 600,
              color: a.danger ? "var(--neg, var(--red))" : "var(--dim)",
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            {a.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeedPresets({
  open, onClose, isNarrow,
  currentFilters, onApply, resultCount,
  describeArgs,
  presets, setPresets,
  defaultPresetId, setDefaultPresetId,
}) {
  const { panelRef, requestClose } = useOverlay({ open, onClose, historyKey: "feedPresets" });
  const [name, setName] = useState("");
  const [sharedId, setSharedId] = useState(null);

  // Which saved screen (if any) the feed is currently showing. Compared by
  // value rather than by a "last applied" id so nudging one control after
  // applying a preset correctly stops counting as that preset.
  const appliedId = useMemo(
    () => presets.find((p) => filtersEqual(p.filters, currentFilters))?.id ?? null,
    [presets, currentFilters]
  );

  useEffect(() => {
    if (!open) { setName(""); setSharedId(null); }
  }, [open]);

  if (!open) return null;

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPresets([...presets, { id: newPresetId(), name: trimmed, filters: currentFilters }]);
    setName("");
  };

  const share = (p) => {
    const url = encodeShareLink(p);
    // The clipboard API needs a secure context; the prompt fallback still
    // lets someone copy the link by hand rather than the button doing nothing.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => { setSharedId(p.id); setTimeout(() => setSharedId(null), 1800); },
        () => window.prompt("Copy this link:", url)
      );
    } else {
      window.prompt("Copy this link:", url);
    }
  };

  const placement = isNarrow
    ? {
        left: 0, right: 0, bottom: 0, maxHeight: "92vh",
        borderRadius: "16px 16px 0 0", borderBottom: "none",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }
    : {
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, 94vw)", maxHeight: "84vh", borderRadius: 16,
      };

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
        aria-label="Saved screens"
        style={{
          position: "fixed", zIndex: Z_DIALOG,
          background: "var(--panel)", border: "1px solid var(--line)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden", outline: "none",
          ...placement,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <span className="oswald" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.03em" }}>
            SAVED SCREENS{presets.length ? ` (${presets.length})` : ""}
          </span>
          <div
            onClick={requestClose}
            role="button"
            tabIndex={0}
            aria-label="Close saved screens"
            onKeyDown={(e) => { if (e.key === "Enter") requestClose(); }}
            style={{ cursor: "pointer", color: "var(--dim)", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px" }}>
          {/* Save the current screen. Shown first because the reason to open
              this panel with nothing saved yet is to save something. */}
          <div style={{ marginBottom: 18 }}>
            <div className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 8 }}>
              SAVE THIS SCREEN
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="select"
                value={name}
                placeholder="Name it — e.g. Sunday NFL"
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveCurrent(); }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={saveCurrent}
                onKeyDown={(e) => { if (e.key === "Enter") saveCurrent(); }}
                className={`chip${name.trim() ? " active" : ""}`}
                style={{ cursor: name.trim() ? "pointer" : "default", opacity: name.trim() ? 1 : 0.5, flexShrink: 0 }}
              >
                Save
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {describePreset(currentFilters, describeArgs).map((c) => <Chip key={c.k + c.v} k={c.k} v={c.v} />)}
            </div>
          </div>

          <div className="oswald" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dim)", letterSpacing: "0.03em", marginBottom: 8 }}>
            YOUR SCREENS
          </div>
          {presets.length === 0 ? (
            <div style={{ color: "var(--dim)", fontSize: 12.5, lineHeight: 1.5, padding: "10px 0 4px" }}>
              Nothing saved yet. A saved screen remembers the sport, prop, side,
              sample size, odds range and matchup filters — so you can get back
              to the exact board you research from without setting it up again.
            </div>
          ) : (
            presets.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                isApplied={p.id === appliedId}
                isDefault={p.id === defaultPresetId}
                describeArgs={describeArgs}
                sharedJustNow={p.id === sharedId}
                onApply={() => { onApply(p.filters); requestClose(); }}
                onShare={() => share(p)}
                onSetDefault={() => setDefaultPresetId(p.id === defaultPresetId ? null : p.id)}
                onRename={() => {
                  const next = window.prompt("Rename this screen:", p.name);
                  if (next && next.trim()) {
                    setPresets(presets.map((x) => (x.id === p.id ? { ...x, name: next.trim().slice(0, 40) } : x)));
                  }
                }}
                onDelete={() => {
                  setPresets(presets.filter((x) => x.id !== p.id));
                  if (defaultPresetId === p.id) setDefaultPresetId(null);
                }}
              />
            ))
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 18px", flexShrink: 0 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={requestClose}
            onKeyDown={(e) => { if (e.key === "Enter") requestClose(); }}
            className="oswald cta-btn"
            style={{
              textAlign: "center", padding: "11px 0", borderRadius: 8, cursor: "pointer",
              background: "var(--amber)", color: "var(--accent-on)",
              fontSize: 13, fontWeight: 700, letterSpacing: "0.03em",
            }}
          >
            SHOW {resultCount} {resultCount === 1 ? "PROP" : "PROPS"}
          </div>
        </div>
      </div>
    </>
  );
}

// Prompt shown when the app is opened with a #screen= link. Kept deliberately
// explicit rather than applying the shared filters on arrival: a link from a
// group chat shouldn't silently rearrange someone's board.
export function SharedScreenBanner({ shared, onApply, onDismiss }) {
  if (!shared) return null;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        margin: "0 auto 14px", maxWidth: 720,
        padding: "11px 14px", borderRadius: "var(--r-lg, 10px)",
        border: "1px solid var(--amber)", background: "var(--amber-dim)",
      }}
    >
      <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, lineHeight: 1.45 }}>
        Someone shared a screen with you: <strong>{shared.name}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <div role="button" tabIndex={0} onClick={onApply} className="chip active" style={{ cursor: "pointer" }}>
          Apply
        </div>
        <div role="button" tabIndex={0} onClick={onDismiss} className="chip" style={{ cursor: "pointer" }}>
          Dismiss
        </div>
      </div>
    </div>
  );
}
