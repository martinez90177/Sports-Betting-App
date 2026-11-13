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
  { n:'Austin Reaves', id:518, team:'lal', opp:'lac', game:'LAL @ LAC', tip:'10:30 PM ET', c:'#552583', c2:'#fdb927',
    pick:'26+ points', line:25.5, fd:-218, dk:null, stat:'points',
    wo:'7 of 8', woTxt:'without Luka Doncic and LeBron James', ven:'4 of 5 on the road', allg:'47 of 134 (all games, at 24.5)',
    bars:[[18,"@MIN",30,"12/13/24"],[26,"SAC",43,"12/28/24"],[45,"IND",41,"2/8/25"],[37,"@DEN",39,"3/14/25"],[51,"@SAC",39,"10/26/25"],[41,"POR",39,"10/27/25"],[28,"@MIN",40,"10/29/25"],[36,"@BOS",33,"12/5/25"]],
    why:'Luka is out and LeBron is gone, so Reaves is the #1 option. In the 8 games both were missing he scored 26+ in 7.',
    vs:'He has scored 29, 31 and 28 in his last three games against the Clippers, all as the number two behind Luka. His three 2024 games (6 in 9 minutes, 20, 14) were a smaller role.',
    risk:'Only 8 games. His line has swung from 19.5 to 29.5 today. His miss was 18 points in 30 minutes.' },
  { n:'Kevin Durant', id:295, team:'hou', opp:'mil', game:'HOU @ MIL', tip:'8:00 PM ET', c:'#ce1141', c2:'#c4ced4',
    pick:'28+ points + assists', line:27.5, fd:-202, dk:null, stat:'pts+ast',
    wo:'8 of 9', woTxt:'without Alperen Sengun (Houston games)', ven:'3 of 3 on the road', allg:'66 of 83 (min 25+, at 25.5)',
    bars:[[36,"PHX",32,"12/5/25"],[30,"@DAL",31,"12/6/25"],[37,"CLE",29,"12/27/25"],[35,"IND",34,"12/29/25"],[30,"PHX",39,"1/5/26"],[37,"@POR",37,"1/7/26"],[34,"@POR",39,"1/9/26"],[37,"NOP",40,"3/13/26"],[20,"LAL",37,"3/16/26"]],
    why:'Sengun is out, so the offense runs through Durant. He cleared 28 in 8 of 9 games without Sengun.',
    vs:'Both games against Milwaukee with Houston cleared this number: 28 at home and 38 on the road.',
    risk:'Nine games. His one miss was 20 points + assists, and in 2026 with Sengun he went 25, 24, 26, 33.' },
  { n:'Shai Gilgeous-Alexander', id:322, team:'okc', opp:'dal', game:'OKC @ DAL', tip:'9:30 PM ET', c:'#007ac1', c2:'#ef3b24',
    pick:'27+ points', line:26.5, fd:-321, dk:null, stat:'points',
    wo:'9 of 11', woTxt:'without Jalen Williams and Chet Holmgren', ven:'3 of 3 on the road (at 25.5)', allg:'144 of 183 (min 25+, at 25.5)',
    bars:[[29,"SAC",30,"2/1/25"],[48,"@DET",38,"3/15/25"],[26,"@LAC",37,"3/23/25"],[31,"SAC",36,"10/28/25"],[31,"WAS",29,"10/30/25"],[30,"NOP",30,"11/2/25"],[35,"@POR",38,"11/5/25"],[27,"GSW",35,"3/7/26"],[35,"DEN",39,"3/9/26"],[26,"PHX",30,"10/26/26"]],
    why:'Williams and Chet are both out (plus Caruso and Wallace), so it all runs through SGA. At 25.5 he was 11 of 11 without them.',
    vs:'He has cleared 26.5 in 5 of 6 against Dallas (31, 39, 36, 30, 33). The one miss was 23 on the road last season.',
    risk:'Both misses at this number were exactly 26 points. FanDuel also offers 25.5 at -421 if you want the safer rung.' },
  { n:'Derik Queen', id:5166, team:'no', opp:'den', game:'DEN @ NOP', tip:'8:00 PM ET', c:'#0c2340', c2:'#c8102e',
    pick:'17+ points + rebounds', line:16.5, fd:-158, dk:null, stat:'pts+reb',
    wo:'12 of 13', woTxt:'without Yves Missi', ven:'7 of 7 at home (at 14.5)', allg:'46 of 49 (min 25+, at 14.5)',
    bars:[[18,"@PHX",25,"11/10/25"],[29,"MIN",39,"12/2/25"],[16,"MIN",29,"12/4/25"],[29,"DAL",34,"12/22/25"],[17,"MIA",31,"2/11/26"],[27,"MIL",28,"2/20/26"],[29,"UTA",37,"4/7/26"],[36,"@BOS",39,"4/10/26"],[52,"@MIN",41,"4/12/26"],[25,"@DEN",25,"10/24/26"]],
    why:'Missi is out for an extended stretch and Queen is the starting center. Twelve of 13 games without Missi cleared 17.',
    vs:'3 of 4 against Denver went over (23, 39, 25). The miss was 12 in only 14 minutes. The 25 came this season with Missi out.',
    risk:'Young player with a short history. One game fell just short at 16, and 2026 also has an 18-minute game.' },
  { n:'Karl-Anthony Towns', id:586, team:'nyk', opp:'chi', game:'NYK @ CHI', tip:'8:00 PM ET', c:'#006bb6', c2:'#f58426',
    pick:'30+ points + rebounds', line:29.5, fd:-303, dk:-228, fdNote:'last seen', stat:'pts+reb',
    wo:'70 of 80', woTxt:'without Mitchell Robinson', ven:'37 of 42 on the road', allg:'133 of 178 (min 25+)',
    bars:[[36,"IND",32,"2/10/26"],[39,"@CHI",32,"2/22/26"],[34,"OKC",33,"3/4/26"],[47,"@LAC",36,"3/9/26"],[31,"@MEM",29,"4/1/26"],[32,"TOR",30,"4/10/26"],[30,"PHI",27,"5/6/26"],[32,"@BOS",37,"10/23/26"],[36,"ORL",33,"10/25/26"],[47,"DET",33,"10/27/26"]],
    why:'Robinson is not in the lineup, and Towns has carried the Knicks inside: 47, 36, 32 and 31 this season, all over 29.',
    vs:'He has cleared 29.5 in all 6 games against Chicago (50, 60, 56, 39, 35, 32), every one at 32+ minutes.',
    risk:'The Knicks are favored by 7.5, so a blowout can trim his fourth quarter (31 in only 24 minutes vs PHI). FanDuel was -303 earlier but not posted in my last pull.' },
];
const MU = {
 'Austin Reaves':'LAC is #6 in defense rating, but is missing Ingram, Beal, Hachimura and Strus. Guards against them this season: 1 of 3 beat their line. Slightly negative.',
 'Kevin Durant':'MIL is #19 in defense and #2 in pace (fastest). 2 of 3 comparable forwards beat their line against them this season. Good.',
 'Shai Gilgeous-Alexander':'DAL is #20 in defense and #28 against assists, and is missing Lively, Aldama and Martin. 2 of 4 comparable guards beat their line. Neutral to soft.',
 'Derik Queen':'DEN is #26 in defense but #28 in pace (slow). Only one comparable big has played them this season, and he missed. Neutral.',
 'Karl-Anthony Towns':'CHI is #27 in defense and #1 in pace (fastest). Comparable bigs went 0 of 5 against their own lines this season (those lines were set far above his), and 12 of 15 beat them last season. Good.'};
const tipMin = t => { const m = t.match(/([0-9]+):([0-9]+) PM/); return (+m[1] % 12) * 60 + +m[2]; };
LEGS.sort((a, b) => tipMin(a.tip) - tipMin(b.tip));
const dec = a => a < 0 ? 1 + 100 / -a : 1 + a / 100;
const am = d => d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1));
const fdList = LEGS.map(l => l.fd ?? l.est);
const fdTot = am(fdList.reduce((a, x) => a * dec(x), 1));
const fmt = v => v > 0 ? '+' + v : String(v);
const dkLegs = LEGS.filter(l => l.dk != null);
const dkPartial = am(dkLegs.reduce((a, l) => a * dec(l.dk), 1));

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
  s += `<text x="${W - R + 12}" y="${y(l.line) + 5}" text-anchor="start" font-size="14" font-weight="700" fill="#ffd34d">needs ${l.line < 100 ? Math.ceil(l.line) : l.line}+</text>`;
  return s + '</svg>';
}

const legCard = (l, i) => `
<section class="leg" style="--c:${l.c};--c2:${l.c2}">
  <div class="lh">
    <div class="num">${i + 1}</div>
    <img class="shot" src="${img(l.id)}" onerror="this.style.visibility='hidden'">
    <div class="who"><div class="nm">${l.n}</div><div class="pk">${l.pick}</div>
      <div class="gm"><img src="${logo(l.team)}"> ${l.game} &middot; ${l.tip}</div></div>
    <div class="pr"><div class="big">${fmt(l.fd)}</div><div class="sm">FanDuel${l.fdNote ? ' (' + l.fdNote + ')' : ''}</div>
      <div class="sm dim">DraftKings ${l.dk != null ? fmt(l.dk) : 'n/a'}</div></div>
  </div>
  <div class="chart">${bars(l)}<div class="cap">Games in tonight's lineup situation (${l.woTxt}), 25+ minutes. Oldest on the left, newest on the right. Green cleared the line, red did not.</div></div>
  <div class="tiles">
    <div class="tile"><b>${l.wo}</b><span>${l.woTxt.split(' (')[0]}</span></div>
    <div class="tile"><b>${l.ven}</b><span>tonight's venue</span></div>
    <div class="tile"><b>${l.allg}</b><span>ignoring the lineup</span></div>
  </div>
  <div class="why"><i>Why it's in</i> ${l.why}</div>
  <div class="mu"><i>Against ${l.opp.toUpperCase()}</i> ${l.vs}</div>
  <div class="mu"><i>Matchup</i> ${MU[l.n]}</div>
  <div class="risk"><i>What could go wrong</i> ${l.risk}</div>
</section>`;

const teams = [['lal', '#552583'], ['lac', '#c8102e'], ['hou', '#ce1141'], ['mil', '#00471b'], ['okc', '#007ac1'], ['dal', '#00538c'], ['no', '#0c2340'], ['den', '#0e2240'], ['chi', '#ce1141'], ['nyk', '#006bb6']];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:1000px 4950px;margin:0}
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
  <h1>Wednesday Night Lotto</h1>
  <div class="sub">Five legs, 8:00 PM ET games and later &middot; overs only &middot; priced 7:34 PM ET Oct 28</div>
  <div class="ticket">
    <div><div class="tot">${fmt(fdTot)}</div><div class="lbl">FanDuel, five-leg parlay (Towns price last seen)</div></div>
    <div class="faces">${LEGS.map(l => `<img src="${img(l.id)}" onerror="this.style.visibility='hidden'">`).join('')}</div>
  </div>
  <div class="mini">${LEGS.map(l => `<div><span>${l.n.split(' ').slice(-1)[0]} &middot; ${l.pick}</span><b>${fmt(l.fd)}</b></div>`).join('')}
    <div><span>DraftKings posts few of these rungs</span><b>n/a</b></div></div>
</div>
<div class="how"><b>How I picked these.</b> Every leg also had to have gone over this number against tonight's team, where the lineups were comparable. Each leg also gets a matchup line: how comparable players did against tonight's defense this season, and where that defense ranks (1 is toughest). Those samples are tiny, so they are a direction, not a verdict. A lotto is not a safe slip, so each leg only has to be a strong, honest lean, around 80% or better in the situation that matches tonight, and priced so six of them land near +500. For every player I first asked who is the main option <i style="display:inline;color:inherit;font-size:inherit;letter-spacing:0;text-transform:none;font-weight:700">tonight</i>, then counted his games with the same teammates out or gone (Luka and LeBron for Reaves, Chet and Jalen Williams for SGA). Records use games of 25+ minutes with his current team. Bars below are those games, newest-season mix, each labelled with opponent and minutes.</div>
${LEGS.map(legCard).join('')}
<div class="swap"><b>Left out, and why.</b> <b>Rollins</b> (points+assists 14.5): his 11 of 11 is mostly from before Tyler Herro arrived. With Herro his games read 23, 19, 17, 12, his points are falling (19, 15, 11, 9), and he has only one game ever against Houston (24). <b>Zion</b> (points 14.5): he has gone over that against Denver in just 2 of 6 games (28, 14, 12, 14, 11, 17). <b>Giddey</b> (rebounds+assists 11.5): 12 of 12 without Vucevic, Dosunmu and Williams, but a top-10 defense, the slowest pace in the league and a thin 2026 log. <b>Bridges</b>: 7 for 7 against Chicago, but 7, 4 and 5 points+assists in three 2026 games of 33-35 minutes. <b>Murray</b> and <b>Gordon</b>: a sample of 3 games, and a miss at 25 minutes. Also out: Jokic, Cade and Maxey (their games are before 8:00 PM ET, or he missed this season), Hartenstein (no FanDuel price).</div>
<div class="foot">Prices as of 7:34 PM ET and they move; confirm in the app before betting. Towns' FanDuel -303 was seen earlier and was not in the last pull (DraftKings -228). Samples are small by nature, because tonight's lineups are new. All legs are overs. 21+. For entertainment; bet responsibly.</div>
</body></html>`;
fs.writeFileSync(OUT, html);
console.log('written', OUT, 'FD', fdTot, 'DKpartial', dkPartial);
