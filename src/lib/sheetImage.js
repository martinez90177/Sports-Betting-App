// A game's cheat sheet drawn as a PNG to post or send -- the Mismatches
// page's "Save image". Drawn straight onto a canvas from the same entry the
// page renders (MismatchGameView's buildSheet), not screenshotted, so it
// needs no library and comes out the same at any screen size.
//
// Colours are read from the page's own tokens at the moment of saving, so the
// image matches the theme and accent the reader has chosen. Availability dots
// use the --status-* tokens and follow the same rule as PlayerAvatar: no
// status on record, no dot.

import { teamInfo } from "./gamesData.js";
import { STATS } from "./nflAllowed.js";

const W = 1080;
const PAD = 56;
const COL_GAP = 40;
const COL_W = (W - PAD * 2 - COL_GAP) / 2;
const ROW_H = 60;
const TARGET_H = 76;
const SCALE = 2;

const MARKET_SHORT = { passYds: "Pass Yds", passTd: "Pass TD", rushYds: "Rush Yds", recYds: "Rec Yds", rec: "Receptions", anytimeTd: "Anytime TD" };
const STATUS_TOKEN = { active: ["--status-available", "#3ecf8e"], questionable: ["--status-questionable", "#e8b13a"], out: ["--status-out", "#ef5b5b"] };

const nick = (abbr) => teamInfo("nfl", abbr).name;
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: t("--bg", "#0d0f12"),
    surface: t("--surface-1", "#15181d"),
    surface2: t("--surface-2", "#1c2026"),
    line: t("--line", "#2a2f37"),
    text: t("--text", "#eef0f3"),
    text2: t("--text-2", "#a9b0ba"),
    dim: t("--dim", "#6f7782"),
    pos: t("--pos", "#3ecf8e"),
    accent: t("--amber-ink", "#6f8cff"),
    status: Object.fromEntries(Object.entries(STATUS_TOKEN).map(([k, [v, hex]]) => [k, t(v, hex)])),
  };
}

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'PP At', 'Space Mono', ui-monospace, monospace";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const headshot = (espnId) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=160&h=160&scale=crop`;
const logo = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr === "WAS" ? "wsh" : abbr.toLowerCase()}.png`;

function rankColor(cell, c) {
  const soft = (cell.rank - 1) / Math.max(1, cell.of - 1);
  return soft >= 0.85 ? c.pos : soft >= 0.65 ? c.accent : c.text2;
}

function badge(ctx, cell, rightX, midY, c) {
  const label = `${cell.tied ? "T" : ""}${ordinal(cell.rank)}`;
  ctx.font = `700 19px ${MONO}`;
  const w = ctx.measureText(label).width + 20;
  const color = rankColor(cell, c);
  roundRect(ctx, rightX - w, midY - 15, w, 30, 7);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rightX - w / 2, midY + 1);
  ctx.textAlign = "left";
  return w;
}

function columnHeight(side) {
  return 34 + Math.max(1, side.rows.length) * ROW_H + 30 + 34 + Math.max(1, side.targets.length) * (TARGET_H + 10);
}

export async function saveSheetImage(entry, { week, throughWeek } = {}) {
  if (document.fonts?.ready) await document.fonts.ready;
  const c = tokens();
  const g = entry.game;
  const bodyH = Math.max(...entry.sides.map(columnHeight));
  const H = PAD + 150 + bodyH + 70 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 24, 24, W - 48, H - 48, 22);
  ctx.fillStyle = c.surface;
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header: eyebrow, the matchup with both logos, kickoff.
  ctx.fillStyle = c.dim;
  ctx.font = `600 17px ${MONO}`;
  ctx.fillText(`PROPPALACE · NFL WEEK ${week ?? ""} CHEAT SHEET`.replace(/\s+CHEAT/, " CHEAT"), PAD, PAD + 22);
  const [awayLogo, homeLogo] = await Promise.all([loadImage(logo(g.away.abbr)), loadImage(logo(g.home.abbr))]);
  const titleY = PAD + 86;
  let x = PAD;
  if (awayLogo) { ctx.drawImage(awayLogo, x, titleY - 42, 50, 50); x += 62; }
  ctx.fillStyle = c.text;
  ctx.font = `800 44px ${DISPLAY}`;
  const title = `${nick(g.away.abbr).toUpperCase()} @ ${nick(g.home.abbr).toUpperCase()}`;
  ctx.fillText(title, x, titleY);
  x += ctx.measureText(title).width + 14;
  if (homeLogo) ctx.drawImage(homeLogo, x, titleY - 42, 50, 50);
  ctx.fillStyle = c.text2;
  ctx.font = `500 19px ${MONO}`;
  ctx.fillText(entry.window.toUpperCase(), PAD, titleY + 40);

  // Two columns, one per defense.
  const top = PAD + 150;
  const heads = await Promise.all(entry.sides.flatMap((s) => s.targets.map((t) => loadImage(headshot(t.card.player.espnId)))));
  let h = 0;
  entry.sides.forEach((side, i) => {
    const cx = PAD + i * (COL_W + COL_GAP);
    let y = top;
    ctx.fillStyle = c.text2;
    ctx.font = `600 16px ${MONO}`;
    ctx.fillText(`${nick(side.def).toUpperCase()} DEFENSE · SOFTEST SPOTS`, cx, y + 16);
    y += 34;
    side.rows.forEach((r) => {
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + COL_W, y); ctx.stroke();
      const bw = badge(ctx, r.cell, cx + COL_W, y + ROW_H / 2, c);
      ctx.fillStyle = c.text;
      ctx.font = `600 16px ${DISPLAY}`;
      const label = `${STATS[r.stat].label} allowed to ${r.grp}s`.toUpperCase();
      ctx.fillText(fitText(ctx, label, COL_W - bw - 112), cx, y + ROW_H / 2 + 6);
      // The per-game figure is the evidence, so it is drawn large, with its
      // distance from the league average under it.
      const vx = cx + COL_W - bw - 14;
      ctx.textAlign = "right";
      ctx.fillStyle = c.dim;
      ctx.font = `500 15px ${MONO}`;
      ctx.fillText("/g", vx, y + ROW_H / 2 + 2);
      const gw = ctx.measureText("/g").width + 3;
      ctx.fillStyle = c.text;
      ctx.font = `800 25px ${DISPLAY}`;
      ctx.fillText(r.cell.value.toFixed(1), vx - gw, y + ROW_H / 2 + 2);
      if (Number.isFinite(r.avg)) {
        const diff = r.cell.value - r.avg;
        ctx.fillStyle = diff > 0 ? c.pos : c.text2;
        ctx.font = `600 14px ${DISPLAY}`;
        ctx.fillText(`${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff).toFixed(1)} vs avg`, vx, y + ROW_H / 2 + 21);
      }
      ctx.textAlign = "left";
      y += ROW_H;
    });
    if (!side.rows.length) {
      ctx.fillStyle = c.dim; ctx.font = `500 17px ${DISPLAY}`;
      ctx.fillText("No ranked stats yet.", cx, y + 30);
      y += ROW_H;
    }
    y += 30;
    ctx.fillStyle = c.text2;
    ctx.font = `600 16px ${MONO}`;
    ctx.fillText(`${nick(side.off).toUpperCase()} TO LOOK AT`, cx, y + 16);
    y += 34;
    if (!side.targets.length) {
      ctx.fillStyle = c.dim; ctx.font = `500 17px ${DISPLAY}`;
      ctx.fillText("Nothing soft enough to name a target.", cx, y + 26);
    }
    side.targets.forEach((t) => {
      roundRect(ctx, cx, y, COL_W, TARGET_H, 12);
      ctx.fillStyle = c.surface2;
      ctx.fill();
      const ax = cx + 14 + 24;
      const ay = y + TARGET_H / 2;
      ctx.save();
      ctx.beginPath(); ctx.arc(ax, ay, 24, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = c.line; ctx.fill();
      ctx.clip();
      const img = heads.shift();
      if (img) ctx.drawImage(img, ax - 24, ay - 24, 48, 48);
      ctx.restore();
      const dot = c.status[t.card.status];
      if (dot) {
        ctx.beginPath(); ctx.arc(ax + 17, ay + 17, 7, 0, Math.PI * 2);
        ctx.fillStyle = dot; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = c.surface2; ctx.stroke();
      }
      const bw = badge(ctx, t.row.cell, cx + COL_W - 14, ay, c);
      ctx.fillStyle = c.text;
      ctx.font = `700 20px ${DISPLAY}`;
      ctx.fillText(fitText(ctx, `${t.card.player.name}  ${t.card.pos}`, COL_W - 100 - bw), ax + 36, ay - 4);
      ctx.fillStyle = c.accent;
      ctx.font = `600 16px ${MONO}`;
      ctx.fillText(MARKET_SHORT[t.row.market] + (t.card.status === "questionable" ? " · QUESTIONABLE" : ""), ax + 36, ay + 20);
      y += TARGET_H + 10;
    });
    h = Math.max(h, y - top);
  });

  // Footer: where it came from.
  ctx.fillStyle = c.dim;
  ctx.font = `500 15px ${MONO}`;
  const foot = `Ranks among 32 defenses, per game allowed to each position · ESPN box scores through Week ${throughWeek ?? ""}`;
  ctx.fillText(fitText(ctx, foot, W - PAD * 2), PAD, H - PAD + 6);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Canvas could not be exported");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proppalace-week${week ?? ""}-${g.away.abbr}-at-${g.home.abbr}.png`.toLowerCase();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}
