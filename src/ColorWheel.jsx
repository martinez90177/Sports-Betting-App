import React, { useEffect, useRef, useState, useCallback } from "react";

// ---------- color math ----------
// All conversions go through HSL since that's the space the wheel/slider
// operate in natively (angle=hue, radius=saturation, slider=lightness).
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function hslToHex(h, s, l) {
  return rgbToHex(...hslToRgb(h, s, l));
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return [216, 88, 58]; // falls back to the app's default blue
  return rgbToHsl(...rgb);
}

// Order and hexes match the redesign handoff's Settings card (647) exactly.
// Lapis leads the row because it's the new app-wide default accent -- see
// --amber's fallback in index.css -- so the preset a reset lands on is the
// same one drawn first here.
// Six hue families, none of them within reach of an outcome colour. Green
// #22c55e and Red #ef4444 used to sit here and were dropped in v2: both landed
// within about ten degrees of the outcome pair (--pos #3ecf8e, --neg #ef5b5b),
// so an accent-coloured control could be read as a hit or a miss. The accent
// means "selected" and must never be mistakable for an outcome -- the same
// separation the availability tokens keep in index.css.
//
// Teal and Rust replace them. Purple and Pink are renamed and Pink is retuned
// to a hue further from --neg. Nobody loses a colour they had picked: the
// accent persists as a hex in propPalaceSettings, not as a preset id, so an
// existing Green or Red simply stops matching a swatch -- the wheel still
// shows it and the hex readout still prints it. The only thing that goes
// missing is the "· GREEN" name caption below the readout, which is guarded
// by PRESET_BY_HEX.has() and renders nothing when there is no match.
export const ACCENT_PRESETS = [
  { label: "Lapis", hex: "#3b5bdb" },
  { label: "Teal", hex: "#14b8a6" },
  // Deepened from #c9a24a, which sat 0.5deg and 0.03 lightness from
  // --status-questionable #e8b13a -- not a near-miss but the same colour, and
  // on a feed row the availability dot and the accent-filled add button are
  // about 40px apart. Moved in *lightness* rather than hue (0.54 -> 0.42, a
  // 5x wider gap) so the swatch is still recognisably gold; shifting the hue
  // would have walked it into Rust.
  { label: "Gold", hex: "#a87d2e" },
  { label: "Rust", hex: "#c2622d" },
  { label: "Violet", hex: "#8b5cf6" },
  { label: "Magenta", hex: "#d6409f" },
];

const PRESET_BY_HEX = new Map(ACCENT_PRESETS.map((p) => [p.hex.toLowerCase(), p.label]));

const WHEEL_SIZE = 220;

function drawWheel(canvas) {
  const size = WHEEL_SIZE;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  const radius = size / 2;
  const image = ctx.createImageData(size * dpr, size * dpr);
  const data = image.data;
  const r2 = (radius * dpr) ** 2;
  const cx = (size * dpr) / 2;
  const cy = (size * dpr) / 2;

  for (let y = 0; y < size * dpr; y++) {
    for (let x = 0; x < size * dpr; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;
      const idx = (y * size * dpr + x) * 4;
      if (distSq > r2) {
        data[idx + 3] = 0; // outside the circle: fully transparent
        continue;
      }
      const dist = Math.sqrt(distSq);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
      const hue = (angle + 360) % 360;
      const sat = Math.min(100, (dist / (radius * dpr)) * 100);
      const [r, g, b] = hslToRgb(hue, sat, 50);
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// Standalone color wheel: hue by angle, saturation by radius, plus a
// lightness slider underneath. Deliberately keeps the expensive per-pixel
// canvas paint to a single one-time draw (see drawWheel) -- the thumb and
// slider are separate absolutely-positioned elements so dragging only ever
// updates cheap inline styles, never repaints the wheel itself.
export default function ColorWheel({ value, onChange, isDefault }) {
  const canvasRef = useRef(null);
  const wheelBoxRef = useRef(null);
  const sliderRef = useRef(null);
  const draggingWheel = useRef(false);
  const draggingSlider = useRef(false);

  const [hsl, setHsl] = useState(() => hexToHsl(value || ACCENT_PRESETS[0].hex));

  // Re-sync from an externally-changed value (e.g. a preset click, or the
  // parent resetting to the saved color) -- but only when we're not the
  // ones currently dragging, so we don't fight our own in-flight updates.
  useEffect(() => {
    if (draggingWheel.current || draggingSlider.current) return;
    if (!value) return;
    const next = hexToHsl(value);
    setHsl((prev) => (hslToHex(...prev) === value ? prev : next));
  }, [value]);

  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current);
  }, []);

  const emit = useCallback((next) => {
    setHsl(next);
    onChange?.(hslToHex(...next));
  }, [onChange]);

  // Reads lightness/hue/sat off the `hsl` state closure (not a setHsl
  // functional updater) so onChange -- which sets state on the parent --
  // runs as a plain call inside this event-handler function, not nested
  // inside React's processing of a different component's state update
  // (that combination is what React's "Cannot update a component while
  // rendering a different component" warning is flagging).
  const setHueSat = useCallback((clientX, clientY) => {
    const box = wheelBoxRef.current.getBoundingClientRect();
    const radius = box.width / 2;
    const dx = clientX - (box.left + radius);
    const dy = clientY - (box.top + radius);
    const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const hue = (angle + 360) % 360;
    const sat = Math.min(100, (dist / radius) * 100);
    const next = [hue, sat, hsl[2]];
    setHsl(next);
    onChange?.(hslToHex(...next));
  }, [hsl, onChange]);

  const setLightness = useCallback((clientX) => {
    const box = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - box.left) / box.width) * 100));
    const next = [hsl[0], hsl[1], pct];
    setHsl(next);
    onChange?.(hslToHex(...next));
  }, [hsl, onChange]);

  useEffect(() => {
    const onMove = (e) => {
      if (draggingWheel.current) setHueSat(e.clientX, e.clientY);
      else if (draggingSlider.current) setLightness(e.clientX);
    };
    const onUp = () => { draggingWheel.current = false; draggingSlider.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setHueSat, setLightness]);

  const [hue, sat, light] = hsl;
  const hex = hslToHex(hue, sat, light);
  const radius = WHEEL_SIZE / 2;
  const thumbDist = (sat / 100) * radius;
  const rad = (hue * Math.PI) / 180;
  const thumbX = radius + Math.cos(rad) * thumbDist;
  const thumbY = radius + Math.sin(rad) * thumbDist;

  return (
    <div>
      <div
        ref={wheelBoxRef}
        onPointerDown={(e) => { draggingWheel.current = true; setHueSat(e.clientX, e.clientY); }}
        style={{
          position: "relative", width: WHEEL_SIZE, height: WHEEL_SIZE, margin: "0 auto",
          touchAction: "none", cursor: "crosshair",
        }}
      >
        <canvas ref={canvasRef} style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: "50%", display: "block" }} />
        {/* Radial wash toward white at the center, layered on top of the
            per-pixel canvas rather than baked into it -- matches the design's
            same two-layer technique (card 647) and keeps the canvas paint a
            one-time cost, see drawWheel. Purely cosmetic: hue/sat picking
            still reads pointer position, not this layer. */}
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle at 50% 50%, #ffffff 0%, rgba(255,255,255,0) 62%)",
          }}
        />
        <div
          style={{
            position: "absolute", left: thumbX, top: thumbY, width: 18, height: 18,
            transform: "translate(-50%, -50%)", borderRadius: "50%",
            background: hslToHex(hue, sat, 50), border: "3px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Lightness slider -- gradient recomputed from hue/sat via inline
          style rather than a second canvas, since a CSS linear-gradient
          already renders it exactly (black -> pure hue/sat color -> white). */}
      <div
        ref={sliderRef}
        onPointerDown={(e) => { draggingSlider.current = true; setLightness(e.clientX); }}
        style={{
          position: "relative", height: 16, borderRadius: 8, marginTop: 16,
          background: `linear-gradient(to right, #000, ${hslToHex(hue, sat, 50)}, #fff)`,
          touchAction: "none", cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute", left: `${light}%`, top: "50%", width: 18, height: 18,
            transform: "translate(-50%, -50%)", borderRadius: "50%",
            background: hex, border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: 12, marginTop: 22, justifyContent: "center" }}>
        {ACCENT_PRESETS.map((p) => (
          <div
            key={p.hex}
            role="button"
            title={p.label}
            onClick={() => emit(hexToHsl(p.hex))}
            style={{
              width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
              background: p.hex,
              border: p.hex.toLowerCase() === hex.toLowerCase() ? "2px solid var(--text)" : "2px solid var(--line)",
              boxShadow: p.hex.toLowerCase() === hex.toLowerCase() ? "0 0 0 2px var(--panel), 0 0 0 3px var(--line)" : "none",
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Live preview + hex readout. The caption names the matched preset,
          and calls out "the default" only when this is the accent no one
          has actually chosen yet -- an explicitly picked Lapis reads as just
          "Lapis", the same as any other preset. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ width: 30, height: 30, background: hex, border: "1px solid var(--line)", flexShrink: 0 }} />
        <div className="pp-mono" style={{ fontSize: 15, color: "var(--text)", letterSpacing: "0.04em" }}>
          {hex.toUpperCase()}
        </div>
        {PRESET_BY_HEX.has(hex.toLowerCase()) && (
          <div className="pp-mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--dim)" }}>
            · {PRESET_BY_HEX.get(hex.toLowerCase()).toUpperCase()}{isDefault ? ", THE DEFAULT" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
