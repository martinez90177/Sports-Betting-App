const fs = require('fs');
const OUT = process.argv[2];
const path = require('path');
const { execFileSync } = require('child_process');
const IMGDIR = path.join(__dirname, 'img');
fs.mkdirSync(IMGDIR, { recursive: true });
// Headshots are embedded as base64 so they always render (remote hotlinks failed in headless Chrome).
const img = id => {
  const f = path.join(IMGDIR, id + '.webp');
  try {
    if (!fs.existsSync(f)) execFileSync('curl', ['-s', '-o', f, '-H', 'Referer: https://propsmadness.com/', '-H', 'User-Agent: Mozilla/5.0', 'https://assets.propsmadness.com/images/players/' + id + '.webp']);
    return 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
  } catch (e) { return 'https://assets.propsmadness.com/images/players/' + id + '.webp'; }
};
const logo = a => `https://a.espncdn.com/i/teamlogos/nba/500/${a}.png`;

const LEGS = [
  { n:'Donovan Mitchell', id:464, team:'cle', opp:'atl', game:'CLE @ ATL', tip:'8:00 PM ET', c:'#6f263d', c2:'#ffb81c',
    pick:'15+ points', line:14.5, dk:-830, fd:-1452,
    wo:'86 of 90', woTxt:'games of 25+ minutes since last season (96%)', ven:'39 of 43 on the road', t3:'4 of 4', t3l:'games this season',
    bars:[[18,"DET",37,"5/15/26"],[26,"@DET",31,"5/17/26"],[29,"@NYK",41,"5/19/26"],[26,"@NYK",39,"5/21/26"],[23,"NYK",38,"5/23/26"],[31,"NYK",32,"5/25/26"],[32,"@PHI",35,"10/22/26"],[22,"BKN",35,"10/24/26"],[26,"MIN",38,"10/26/26"],[19,"WAS",31,"10/28/26"]],
    why:'He is Cleveland\'s clear #1: 17.0 shots a game, 27% usage and 24.8 points this season. All 10 of his last games cleared this line and the lowest was 18, a 3.5-point cushion.',
    vs:'He has gone over 14.5 in all 3 games against Atlanta (37, 42 and 31 points).',
    mu:'ATL is #13 in defense rating and #4 in pace (fast), so there are plenty of possessions. 3 of 5 comparable guards cleared this number against them. Neutral.',
    risk:'A blowout could trim his minutes (he scored 19 in 31 minutes last game), and he now shares the ball with Harden. Even so, his floor sits well over the line.' },
  { n:'Evan Mobley', id:465, team:'cle', opp:'atl', game:'CLE @ ATL', tip:'8:00 PM ET', c:'#6f263d', c2:'#ffb81c',
    pick:'12+ points', line:11.5, dk:-552, fd:-651,
    wo:'76 of 81', woTxt:'games of 25+ minutes since last season (94%)', ven:'37 of 42 on the road', t3:'4 of 4', t3l:'games this season',
    bars:[[18,"DET",36,"5/15/26"],[21,"@DET",36,"5/17/26"],[15,"@NYK",40,"5/19/26"],[14,"@NYK",37,"5/21/26"],[24,"NYK",36,"5/23/26"],[15,"NYK",33,"5/25/26"],[18,"@PHI",34,"10/22/26"],[20,"BKN",35,"10/24/26"],[18,"MIN",38,"10/26/26"],[24,"WAS",32,"10/28/26"]],
    why:'He is Cleveland\'s #3 option behind Mitchell and Harden: 20.0 points, 10.0 rebounds on 12.3 shots, 34.8 minutes. I use plain points, not points+assists, because he averages only 2.8 assists. Every one of his last 10 cleared 11.5 and the lowest was 14.',
    vs:'He has gone over 11.5 in 3 of 4 games against Atlanta (14, 20 and 22 points). The miss was 10 points last April.',
    mu:'ATL is #13 in defense rating and #4 in pace. Only 2 comparable big men are on record against them (1 cleared), too few to read much into.',
    risk:'He is the #3 scorer, so a quiet shooting night is the risk. The 10-point game against Atlanta last April was a miss, and 14 and 15 are in his last 10.' },
  { n:'Zion Williamson', id:629, team:'no', opp:'sac', game:'SAC @ NOP', tip:'8:00 PM ET', c:'#0c2340', c2:'#85714d',
    pick:'20+ points + rebounds', line:19.5, dk:-600, fd:-674,
    wo:'16 of 18', woTxt:'games without Dejounte Murray and Jordan Poole (89%)', ven:'26 of 31 at home', t3:'51 of 60', t3l:'games of 25+ minutes since last season (85%)',
    bars:[[27,"@DET",31,"3/26/26"],[29,"@TOR",31,"3/27/26"],[22,"HOU",25,"3/29/26"],[16,"@POR",29,"4/2/26"],[19,"@SAC",29,"4/3/26"],[24,"ORL",28,"4/5/26"],[25,"IND",32,"10/21/26"],[28,"@UTA",33,"10/23/26"],[18,"@DEN",33,"10/24/26"],[30,"DEN",32,"10/28/26"]],
    why:'New Orleans just ruled out Dejounte Murray (personal) and Jordan Poole (ankle), and Missi is out too, so Zion is the #1 option tonight: his points line moved from 19.5 to 22.5 this afternoon. He averages 21.8 points on 13.3 shots (23% usage). Without Murray and Poole he went over 19.5 points+rebounds in 16 of 18 games, averaging 26.7.',
    vs:'He went over 19.5 in 2 of 3 games against Sacramento (23, 32, and 19 last April, a miss by half a point).',
    mu:'SAC is #29 in defense rating, the softest on the slate, and #13 in pace. Comparable forwards cleared this number 2 of 5 times and beat their own lines 2 of 5, so the matchup is not a free pass.',
    risk:'This is not his old 11.5 rung: that one is now -1800. Points+rebounds 19.5 was missed in 3 of his last 10 (16, 18 and 19) and the Murray/Poole sample is last season with only 18 games.' },
  { n:'Ty Jerome', id:388, team:'mem', opp:'por', game:'MEM @ POR', tip:'10:00 PM ET', c:'#5d76a9', c2:'#fdb927',
    pick:'20+ points + assists', line:19.5, dk:-990, fd:-1401,
    wo:'9 of 9', woTxt:'games of 25+ minutes since last season (100%, small sample)', ven:'10 of 12 on the road', t3:'4 of 4', t3l:'games this season',
    bars:[[30,"LAC",25,"3/7/26"],[34,"@PHI",25,"3/10/26"],[24,"@DET",25,"3/13/26"],[30,"DEN",25,"3/18/26"],[23,"BOS",25,"3/20/26"],[21,"@ATL",24,"3/23/26"],[51,"UTA",32,"10/21/26"],[33,"@GSW",32,"10/23/26"],[38,"@SAC",32,"10/25/26"],[23,"@UTA",30,"10/26/26"]],
    why:'He is Memphis\' clear #1 this season: 19.8 shots, 31% usage, 29.8 points and 6.5 assists a game. Points plus assists beat 19.5 in all of his last 10, with six games of 30 or more, and the lowest was 21.',
    vs:'He played Portland once, on 2/7/26, and had 14 points plus assists, a miss.',
    mu:'POR is #11 in defense rating and #16 in pace. 1 of 2 comparable guards cleared this number against them. Neutral.',
    risk:'The longest price on the slip (-990). The March games came in about 25 minutes each and only 4 games are from this season, so the sample is thin, and his one game against Portland was a miss.' },
  { n:'Deni Avdija', id:195, team:'por', opp:'mem', game:'MEM @ POR', tip:'10:00 PM ET', c:'#e03a3e', c2:'#f0f0f0',
    pick:'15+ points', line:14.5, dk:-870, fd:-1201,
    wo:'67 of 70', woTxt:'games of 25+ minutes since last season (96%)', ven:'36 of 36 at home', t3:'3 of 3', t3l:'games this season',
    bars:[[25,"SAC",33,"4/12/26"],[41,"@PHX",38,"4/14/26"],[30,"@SAS",39,"4/19/26"],[14,"@SAS",30,"4/21/26"],[19,"SAS",37,"4/24/26"],[26,"SAS",37,"4/26/26"],[22,"@SAS",32,"4/28/26"],[18,"PHX",23,"10/21/26"],[26,"@SAC",38,"10/23/26"],[23,"@LAL",33,"10/27/26"]],
    why:'He is Portland\'s #1 option even after the new guards: 15.7 shots, 28% usage and 22.3 points a game. He has cleared 14.5 in every home game in this sample.',
    vs:'He played Memphis once, on 12/7/25, and scored 17, over the line.',
    mu:'MEM is #6 in defense rating and #19 in pace, a tough defense rank that I flag but do not treat as a veto. 2 of 2 comparable forwards beat their own lines against them (LaVine 37, Podziemski 18).',
    risk:'The thinnest leg: 9 of 10, with one 14-point game in his last 10 and one game of only 23 minutes this season. Only 3 games this season.' },
];
const tipMin = t => { const m = t.match(/([0-9]+):([0-9]+) PM/); return (+m[1] % 12) * 60 + +m[2]; };
LEGS.sort((a, b) => tipMin(a.tip) - tipMin(b.tip));
const dec = a => a < 0 ? 1 + 100 / -a : 1 + a / 100;
const am = d => d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1));
const dkTot = am(LEGS.reduce((a, l) => a * dec(l.dk), 1));
const fdTot = am(LEGS.reduce((a, l) => a * dec(l.fd), 1));
const fmt = v => v > 0 ? '+' + v : String(v);

function bars(l) {
  const W = 880, H = 214, pad = 34, R = 96, n = l.bars.length, bw = Math.min(64, (W - pad - R) / n - 12);
  const max = Math.max(...l.bars.map(b => b[0]), l.line) * 1.18;
  const y = v => H - 48 - (v / max) * (H - 74);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  const gap = (W - pad - R) / n;
  l.bars.forEach((b, i) => {
    const x = pad + i * gap + (gap - bw) / 2; const over = b[0] > l.line;
    s += `<rect x="${x}" y="${y(b[0])}" width="${bw}" height="${H - 48 - y(b[0])}" rx="5" fill="${over ? '#2fbf71' : '#e5534b'}"/>`;
    s += `<text x="${x + bw / 2}" y="${y(b[0]) - 6}" text-anchor="middle" font-size="17" font-weight="800" fill="#f2f4f8">${b[0]}</text>`;
    s += `<text x="${x + bw / 2}" y="${H - 32}" text-anchor="middle" font-size="12" fill="#9aa3b5">${b[1]}</text>`;
    s += `<text x="${x + bw / 2}" y="${H - 19}" text-anchor="middle" font-size="10" fill="#6f788b">${b[2]}m</text><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#6f788b">${b[3]}</text>`;
  });
  s += `<line x1="${pad - 8}" x2="${W - R + 6}" y1="${y(l.line)}" y2="${y(l.line)}" stroke="#ffd34d" stroke-width="2" stroke-dasharray="6 5"/>`;
  s += `<text x="${W - R + 12}" y="${y(l.line) + 5}" text-anchor="start" font-size="14" font-weight="700" fill="#ffd34d">needs ${Math.ceil(l.line)}+</text>`;
  return s + '</svg>';
}

const legCard = (l, i) => `
<section class="leg" style="--c:${l.c};--c2:${l.c2}">
  <div class="lh">
    <div class="num">${i + 1}</div>
    <img class="shot" src="${img(l.id)}" onerror="this.style.visibility='hidden'">
    <div class="who"><div class="nm">${l.n}</div><div class="pk">${l.pick}</div>
      <div class="gm"><img src="${logo(l.team)}"> ${l.game} &middot; ${l.tip}</div></div>
    <div class="pr"><div class="big">${fmt(l.dk)}</div><div class="sm">DraftKings</div>
      <div class="sm dim">FanDuel ${fmt(l.fd)}</div></div>
  </div>
  <div class="chart">${bars(l)}<div class="cap">His last 10 games with his current team, oldest on the left, newest on the right (playoffs included). Green cleared the line, red did not.</div></div>
  <div class="tiles">
    <div class="tile"><b>${l.wo}</b><span>${l.woTxt}</span></div>
    <div class="tile"><b>${l.ven}</b><span>tonight's venue</span></div>
    <div class="tile"><b>${l.t3}</b><span>${l.t3l}</span></div>
  </div>
  <div class="why"><i>Why it's in</i> ${l.why}</div>
  <div class="mu"><i>Against ${l.opp.toUpperCase()}</i> ${l.vs}</div>
  <div class="mu"><i>Matchup</i> ${l.mu}</div>
  <div class="risk"><i>What could go wrong</i> ${l.risk}</div>
</section>`;

const teams = [['cle', '#6f263d'], ['atl', '#e03a3e'], ['no', '#0c2340'], ['sac', '#5a2d81'], ['mem', '#5d76a9'], ['por', '#e03a3e']];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:1000px 4900px;margin:0}
*{box-sizing:border-box}body{margin:0;background:#0d1017;color:#eef1f7;font-family:'Segoe UI',Arial,sans-serif;width:1000px}
.hero{padding:34px 40px 26px;background:linear-gradient(135deg,#141a26,#0d1017)}
.stripe{display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:22px}.stripe i{flex:1}
.logos{display:flex;gap:14px;margin-bottom:16px}.logos img{height:44px}
h1{margin:0;font-size:38px;letter-spacing:.5px}.sub{color:#9aa3b5;margin-top:6px;font-size:16px}
.ticket{margin-top:22px;border:2px dashed #3a4357;border-radius:18px;padding:22px 26px;display:flex;align-items:center;gap:26px;background:#121827}
.ticket .tot{font-size:68px;font-weight:900;color:#2fbf71;line-height:1}.ticket .lbl{color:#9aa3b5;font-size:14px;margin-top:6px}
.ticket .faces{display:flex;margin-left:auto}.faces img{width:68px;height:68px;border-radius:50%;object-fit:cover;background:#222a3b;border:3px solid #121827;margin-left:-14px}
.mini{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;font-size:15px}.mini div{display:flex;justify-content:space-between;border-bottom:1px solid #1f2738;padding:5px 0}
.mini b{color:#2fbf71}
.how{margin:22px 40px 0;padding:16px 20px;background:#121827;border-radius:14px;color:#b6bdcc;font-size:14.5px;line-height:1.5}.how b{color:#eef1f7}
.leg{margin:26px 40px 0;border-radius:18px;background:#121827;border-top:6px solid var(--c);overflow:hidden}
.lh{display:flex;align-items:center;gap:16px;padding:18px 22px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 38%,#121827),#121827)}
.num{font-size:30px;font-weight:900;color:var(--c2);width:34px}.shot{width:78px;height:78px;border-radius:50%;object-fit:cover;background:#222a3b;border:3px solid var(--c2)}
.nm{font-size:26px;font-weight:800}.pk{font-size:20px;color:var(--c2);font-weight:700;margin-top:2px}.gm{font-size:13.5px;color:#9aa3b5;margin-top:5px;display:flex;align-items:center;gap:6px}.gm img{height:20px}
.pr{margin-left:auto;text-align:right}.big{font-size:40px;font-weight:900}.sm{font-size:13px;color:#b6bdcc}.dim{color:#7e879a}
.chart{padding:8px 22px 0}.cap{font-size:12.5px;color:#7e879a;margin:2px 0 8px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 22px}
.tile{background:#0d1320;border-radius:12px;padding:12px 14px}.tile b{display:block;font-size:19px}.tile span{font-size:12.5px;color:#8b94a7}
.mu{margin:12px 22px 0;font-size:15px;line-height:1.45;color:#c9d3e6}.why,.risk{margin:12px 22px 0;font-size:15px;line-height:1.45}.risk{margin-bottom:20px;color:#e9c2bf}
i{font-style:normal;font-weight:800;font-size:12px;letter-spacing:.8px;text-transform:uppercase;display:block;color:#9aa3b5;margin-bottom:2px}
.foot{margin:28px 40px 40px;color:#7e879a;font-size:12.5px;line-height:1.6}
.swap{margin:22px 40px 0;padding:16px 20px;border:1px solid #2a3348;border-radius:14px;font-size:14.5px;color:#b6bdcc;line-height:1.5}.swap b{color:#eef1f7}
</style></head><body>
<div class="hero">
  <div class="stripe">${teams.map(t => `<i style="background:${t[1]}"></i>`).join('')}</div>
  <div class="logos">${teams.map(t => `<img src="${logo(t[0])}">`).join('')}</div>
  <h1>Thursday Night Ladder</h1>
  <div class="sub">Five legs &middot; 8:00 PM ET games and later &middot; overs only &middot; DraftKings &middot; priced 6:31 PM ET Oct 29, after the 6:20 PM injury news</div>
  <div class="ticket">
    <div><div class="tot">${fmt(dkTot)}</div><div class="lbl">DraftKings, five-leg ladder (FanDuel prices the same rungs at ${fmt(fdTot)})</div></div>
    <div class="faces">${LEGS.map(l => `<img src="${img(l.id)}" onerror="this.style.visibility='hidden'">`).join('')}</div>
  </div>
  <div class="mini">${LEGS.map(l => `<div><span>${l.n.split(' ').slice(-1)[0]} &middot; ${l.pick}</span><b>${fmt(l.dk)}</b></div>`).join('')}</div>
</div>
<div class="how"><b>How I picked these.</b> A ladder is meant to be the easiest slip to cash. I started from your saved NBA board, then swept every DraftKings rung from -200 to -1100 for the main players on tonight's three games. I kept rungs that went over in at least 9 of the last 10 and at least 4 of the last 5, with at most one miss this season and a 90%+ record in 25+ minute games. Then I checked the injury report: at about 6:20 PM ET New Orleans ruled out <b>Dejounte Murray</b> and <b>Jordan Poole</b>, which killed my Murray leg and moved Zion's points line from 19.5 to 22.5. His 11.5 rung (my earlier pick) is now -1800, so Zion is re-read without Murray and Poole and moved to points+rebounds 19.5. Each bar is one game with the opponent, minutes and date.</div>
${LEGS.map(legCard).join('')}
<div class="swap"><b>Left out, and why.</b> <b>Dejounte Murray</b> (my earlier rebounds+assists leg) is out, and so is Poole. <b>Zion points 11.5</b> repriced to -1800, past your limit. <b>Trey Murphy points+rebounds 14.5</b> (-1000): 6 of 6 without Murray, Poole and Missi and 27 of 28 without Murray and Poole, but this season he averages 13.0 points on 11 shots and scored just 7 points+rebounds last night, so I left him as an optional sixth leg that moves the slip to about +109. <b>Johnson rebounds 6.5</b> (-548): 9 of 10, but one 3-rebound game. <b>Sabonis</b>: only 74% without Keegan Murray. <b>Lillard and Morant</b>: no rung in this price range passed.</div>
<div class="foot">Prices as of 6:31 PM ET and they move; confirm in the app before betting. FanDuel prices the same rungs shorter, so DraftKings is the better book for this slip. Samples are small where lineups are new (Jerome has 4 games this season, Avdija 3, and the Zion/Murray-out sample is from last season). All legs are overs. 21+. For entertainment; bet responsibly.</div>
</body></html>`;
fs.writeFileSync(OUT, html);
console.log('written', OUT, 'DK total', dkTot, 'FD total', fdTot);
