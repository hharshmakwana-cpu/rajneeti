// RAJNEETI — casual mobile game interface. One big card, a few big buttons,
// and an animated reaction to every choice.

const UI = { screen: 'title', reveal: null, setup: null, toastT: null, deal: null, pdeal: null, card: 0, busy: false, live: null, tugPrev: null, meterPrev: null };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } };
const wait = FX.wait;

const PROMISE_ICON = { loanwaiver: '🚜', msp: '🌾', taxcut: '💸', jobs: '👷', ops: '👴', cash: '👩', health: '🏥', corptax: '🏢', prices: '🧅', infra: '🛣️', lokpal: '🕵️', skills: '🛠️' };
const REFORM_ICON = { gst: '🧾', labour: '🏭', farmmkt: '🌽', msp: '🌾', loanwaiver: '🚜', pli: '📱', disinvest: '🏷️', bankrecap: '🏦', health: '🏥', cash: '👩', ops: '👴', itsimple: '📄', green: '☀️', dpi: '📲', lokpal: '🕵️', land: '🏗️', urbanjobs: '🧱', skills: '🛠️', demo: '💵', onoe: '🗳️' };
const RIVAL_FACE = '😈';

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + kind;
  if (kind === 'bad') Sound.play('bad');
  clearTimeout(UI.toastT);
  UI.toastT = setTimeout(() => { t.className = 'toast'; }, 2400);
}

function handle(res) {
  if (!res) return;
  if (res.err) { toast(res.err, 'bad'); buzz(40); }
  else if (res.msg) { toast(res.msg, res.fail ? 'bad' : 'good'); buzz(15); }
  render();
}

// 👍🌾 👎💼 — who likes / dislikes something, as emoji only
function fans(blocs) {
  const up = [], down = [];
  for (const [b, v] of Object.entries(blocs)) (v > 0 ? up : down).push(BLOCS.find(x => x.id === b).icon);
  return `<div class="fans">${up.length ? `<span class="like">👍 ${up.join('')}</span>` : ''}${down.length ? `<span class="dislike">👎 ${down.join('')}</span>` : ''}</div>`;
}

const word = (good, ok) => good ? '😀 Yes' : ok ? '😐 OK' : '😟 No';

// The tug-of-war seat bar. It is drawn at the previous numbers and then
// animated to the new ones by animateTug() after each render.
function tug(you, A, label = 'Get 272 to win 👑') {
  const p = UI.tugPrev || { you, A };
  const w = x => (x / TOTAL_SEATS * 100).toFixed(1) + '%';
  return `<div class="tug" data-you="${you}" data-a="${A}">
    <div class="tugtop"><span class="who"><i class="av me-av" style="background:${G.color}">${G.symbol}</i><b class="n-you">${p.you}</b></span><span class="need">${label}</span><span class="who right"><b class="n-a">${p.A}</b><i class="av them-av" style="background:${RIVALS.A.color}">${RIVAL_FACE}</i></span></div>
    <div class="tugbar"><i class="me" style="width:${w(p.you)};background:${G.color}"></i><i class="them" style="width:${w(p.A)};background:${RIVALS.A.color}"></i><span class="crown">👑</span></div>
  </div>`;
}

function animateTug(ms = 800) {
  const t = $('.tug');
  if (!t) { UI.tugPrev = null; return; }
  const you = +t.dataset.you, A = +t.dataset.a, p = UI.tugPrev || { you, A };
  const w = x => (x / TOTAL_SEATS * 100).toFixed(1) + '%';
  requestAnimationFrame(() => {
    t.querySelector('.me').style.width = w(you);
    t.querySelector('.them').style.width = w(A);
  });
  FX.countUp(t.querySelector('.n-you'), p.you, you, ms);
  FX.countUp(t.querySelector('.n-a'), p.A, A, ms);
  if (ms >= 500) {
    if (you > p.you) { FX.floatText(t.querySelector('.n-you'), `+${you - p.you}`, '#16a34a'); t.querySelector('.me-av').classList.add('hop'); }
    if (you < p.you) { FX.floatText(t.querySelector('.n-you'), `−${p.you - you}`, '#dc2626'); t.querySelector('.me-av').classList.add('sad'); }
    if (A > p.A) t.querySelector('.them-av').classList.add('hop');
  }
  UI.tugPrev = { you, A };
}

function muteBtn() {
  return `<button class="menu" data-a="mute" aria-label="Sound on or off">${Sound.settings.muted ? '🔇' : '🔊'}</button>`;
}

function topbar(chips) {
  return `<header class="top">${chips.map((c, i) => `<span class="chip" id="chip${i}">${c}</span>`).join('')}<span class="grow"></span>${muteBtn()}<button class="menu" data-a="menu" aria-label="Menu">☰</button></header>`;
}

// ---------------- title & setup ----------------
function renderTitle() {
  return `<div class="screen title">
    <div class="sky"></div>
    <div class="titlemute">${muteBtn()}</div>
    <div class="logo-art">🏛️</div>
    <h1 class="logo">${'RAJNEETI'.split('').map((ch, i) => `<span style="animation-delay:${i * 70}ms">${ch}</span>`).join('')}</h1>
    <p class="sub">Become Prime Minister!</p>
    <div class="spacer"></div>
    ${hasSave() ? '<button class="gbtn green big glow" data-a="continue">▶ CONTINUE</button>' : ''}
    <button class="gbtn ${hasSave() ? 'blue' : 'green glow'} big" data-a="newgame">${hasSave() ? 'NEW GAME' : '▶ PLAY'}</button>
    <button class="gbtn ghost" data-a="help">How to play</button>
  </div>`;
}

function renderSetup() {
  const s = UI.setup;
  return `<div class="screen title">
    <div class="sky"></div>
    <div class="hero-av" style="background:${s.color}">${s.symbol}</div>
    <h2 class="white">Who are you?</h2>
    <input id="f-leader" class="bigin" maxlength="22" value="${esc(s.leader)}" placeholder="Your name">
    <p class="white small">Pick your party symbol</p>
    <div class="symbols">${PARTY_SYMBOLS.map((x, i) => `<button class="symb ${s.symbol === x ? 'on' : ''}" style="background:${PARTY_COLORS[i % PARTY_COLORS.length]}" data-a="setsym" data-v="${x}" data-c="${PARTY_COLORS[i % PARTY_COLORS.length]}">${x}</button>`).join('')}</div>
    <div class="spacer"></div>
    <button class="gbtn green big glow" data-a="start">START ▶</button>
  </div>`;
}

function helpHTML() {
  return `<h2>How to play</h2>
  <div class="howto">
    <div><span>🃏</span><p>Pick a card each turn.</p></div>
    <div><span>🤝</span><p>Make friends with local parties — they bring seats.</p></div>
    <div><span>${RIVAL_FACE}</span><p>The RSP plays too! Watch what they do.</p></div>
    <div><span>👑</span><p>Get <b>272 seats</b> to become PM.</p></div>
    <div><span>👉</span><p>As PM, swipe right to say yes, left to say no.</p></div>
  </div>
  <button class="gbtn green" data-a="closemodal">OK!</button>`;
}

// ---------------- campaign ----------------
function dealCampaign() {
  const C = G.camp, cards = [];
  const sh = s => stateShares(s);
  const battle = STATES.filter(s => s.seats >= 10).map(s => { const x = sh(s); return { s, v: s.seats * (1.2 - Math.abs(x[0] - x[1])) * (1 + rand() * .6) }; }).sort((a, b) => b.v - a.v);
  if (C.funds >= 15) cards.push({ k: 'rally', s: battle[0].s.id });
  const allies = STATES.filter(s => s.reg && C.alliances[s.id] !== 'you' && !actionBlocked('alliance', s.id))
    .map(s => ({ s, v: allianceChance(s.id) * s.seats * (1 + rand() * .8) })).sort((a, b) => b.v - a.v);
  if (allies.length) cards.push({ k: 'alliance', s: allies[0].s.id });
  if (C.funds < 40) cards.push({ k: 'fundraise' });
  else cards.push({ k: rand() < .65 ? 'ads' : 'attack' });
  if (cards.length < 3 && !cards.some(c => c.k === 'fundraise')) cards.push({ k: 'fundraise' });
  if (cards.length < 3 && C.funds >= 15) cards.push({ k: 'rally', s: battle[1].s.id });
  UI.deal = cards;
  Sound.play('deal');
}

function moveCard(c, i) {
  const s = c.s ? stateById(c.s) : null;
  let icon, title, sub, badge;
  if (c.k === 'rally') { icon = '📣'; title = `Big rally in ${s.name}`; sub = `Win hearts · ${s.seats} seats`; badge = '💰15'; }
  if (c.k === 'alliance') { const ch = allianceChance(s.id); icon = '🤝'; title = `Make friends in ${s.name}`; sub = `Their local party joins you`; badge = ch >= .5 ? 'Easy 😀' : ch >= .25 ? 'Maybe 🤞' : 'Hard 😬'; }
  if (c.k === 'ads') { icon = '📺'; title = 'Ads on TV'; sub = 'Everyone sees you'; badge = '💰40'; }
  if (c.k === 'attack') { icon = '⚔️'; title = 'Show RSP mistakes'; sub = 'Can go wrong!'; badge = '💰10'; }
  if (c.k === 'fundraise') { icon = '💰'; title = 'Collect money'; sub = 'Get 💰50 more'; badge = 'FREE'; }
  const blocked = actionBlocked(c.k, c.s);
  return `<button class="mcard" data-a="move" data-i="${i}" ${blocked ? 'disabled' : ''} style="animation-delay:${i * 90}ms">
    <span class="mi">${icon}</span><span class="mt"><b>${title}</b><small>${sub}</small></span><span class="badge">${badge}</span></button>`;
}

function livePoll() { return UI.live || G.camp.polls[G.camp.polls.length - 1]; }

function weekPath() {
  const C = G.camp;
  return `<div class="path">${Array.from({ length: C.weeks }, (_, i) => `<i class="${i + 1 < C.week ? 'done' : i + 1 === C.week ? 'now' : ''}">${i + 1 === C.weeks ? '🗳️' : ''}</i>`).join('')}</div>`;
}

function renderCampaign() {
  const C = G.camp;
  const last = livePoll();
  if (!C.manifestoDone && !C.promises.length) return renderManifesto(last);
  if (!UI.deal) dealCampaign();
  const ev = C.event && CAMPAIGN_EVENTS.find(e => e.id === C.event.id);
  return `<div class="screen">
    ${topbar([`📅 Week ${C.week}`, `💰 <b class="money">${Math.round(C.funds)}</b>`])}
    ${weekPath()}
    ${tug(last.youBloc, last.aBloc)}
    ${ev ? eventCard(ev, C.event.ctx, 'cev') : `
    <div class="stage">
      <p class="prompt">Pick one! <span class="dots">${'●'.repeat(C.ap)}${'○'.repeat(C.apMax - C.ap)}</span></p>
      <div class="mcards">${UI.deal.map(moveCard).join('')}</div>
    </div>`}
  </div>`;
}

function renderManifesto(last) {
  if (!UI.pdeal) {
    const chosen = UI.picked || [];
    UI.pdeal = PROMISES.filter(p => !chosen.includes(p.id)).sort(() => rand() - .5).slice(0, 3).map(p => p.id);
    Sound.play('deal');
  }
  const n = (UI.picked || []).length;
  return `<div class="screen">
    ${topbar([`📜 Promise ${n + 1} of 3`])}
    ${tug(last.youBloc, last.aBloc)}
    <div class="stage">
      <p class="prompt">What do you promise India?</p>
      <div class="mcards">${UI.pdeal.map((id, i) => {
        const p = PROMISES.find(x => x.id === id);
        return `<button class="mcard" data-a="promise" data-id="${id}" style="animation-delay:${i * 90}ms"><span class="mi">${PROMISE_ICON[id]}</span><span class="mt"><b>${p.name}</b>${fans(p.blocs)}</span></button>`;
      }).join('')}</div>
    </div>
  </div>`;
}

function eventCard(ev, ctx, kind) {
  const choices = ev.choices(G, ctx);
  const crisis = kind === 'gev';
  return `<div class="stage">
    <div class="bigcard news flipin ${crisis ? 'alert' : ''}">
      <div class="kicker">${crisis ? '🚨 NEWS!' : '📰 NEWS!'}</div>
      <div class="emo wobble">${ev.icon}</div><h2>${ev.title}</h2><p>${esc(ev.text(G, ctx))}</p>
    </div>
    <div class="answers">${choices.map((c, i) => `<button class="gbtn ${['blue', 'orange', 'red'][i]} pop-in" style="animation-delay:${200 + i * 90}ms" data-a="${kind}" data-i="${i}" ${(c.pc && G.gov && c.pc > G.gov.pc) || (c.cost && G.camp && kind === 'cev' && c.cost > G.camp.funds) ? 'disabled' : ''}>${c.label}${c.cost ? ` <small>💰${c.cost}</small>` : ''}${c.pc ? ` <small>${c.pc}⭐</small>` : ''}</button>`).join('')}</div>
  </div>`;
}

// ---------------- results ----------------
function resultMap(r, shown) {
  const seen = new Set(shown.map(s => s.id));
  return `<div class="rmap">${STATES.map(s => {
    let col = 'rgba(255,255,255,.25)', cls = '';
    if (seen.has(s.id)) {
      const x = r.byState[s.id], al = r.alliances[s.id];
      const y = x.you + (al === 'you' ? x.R : 0), a = x.A + (al === 'A' ? x.R : 0);
      col = y > a ? G.color : a > y ? RIVALS.A.color : '#9ca3af'; cls = 'lit';
    }
    return `<i class="${cls}" style="grid-column:${s.pos[0] + 1};grid-row:${s.pos[1] + 1};background:${col}">${s.id}</i>`;
  }).join('')}</div>`;
}

function renderResults() {
  const r = G.result;
  const order = STATES.slice().sort((a, b) => a.seats - b.seats);
  if (!UI.reveal) {
    UI.reveal = { n: 0 };
    Sound.music('tense');
    const step = () => {
      if (!UI.reveal || G.phase !== 'results') return;
      UI.reveal.n++; buzz(5); Sound.play('tick');
      render();
      if (UI.reveal.n < order.length) UI.reveal.timer = setTimeout(step, 120 + UI.reveal.n * 9);
      else finishReveal();
    };
    UI.reveal.timer = setTimeout(step, 900);
  }
  let you = 0, A = 0;
  const shown = order.slice(0, UI.reveal.n);
  for (const s of shown) {
    const x = r.byState[s.id], al = r.alliances[s.id];
    you += x.you + (al === 'you' ? x.R : 0); A += x.A + (al === 'A' ? x.R : 0);
  }
  const done = UI.reveal.n >= order.length;
  const latest = shown[shown.length - 1];
  let verdict = '';
  if (done) {
    if (r.youBloc >= MAJORITY) verdict = '<div class="verdict win">🎉 YOU WIN! 🎉</div>';
    else if (r.aBloc >= MAJORITY) verdict = '<div class="verdict lose">😢 RSP WINS</div>';
    else verdict = '<div class="verdict">🤔 Nobody got 272!</div>';
  }
  return `<div class="screen">
    ${topbar(['🗳️ Counting votes'])}
    <div class="stage results-stage">
      ${tug(you, A, '272 to win')}
      ${resultMap(r, shown)}
      ${!done && latest ? `<p class="prompt counting">${latest.name}…</p>` : verdict}
    </div>
    <div class="bottom">${done ? '<button class="gbtn green big glow" data-a="afterresults">NEXT ▶</button>' : '<button class="gbtn ghost" data-a="skipreveal">Skip ⏩</button>'}</div>
  </div>`;
}

function finishReveal() {
  const r = G.result;
  if (r.youBloc >= MAJORITY) { Sound.play('win'); FX.confetti(160); setTimeout(() => FX.confetti(120), 700); }
  else if (r.aBloc >= MAJORITY) { Sound.play('lose'); FX.shake(); }
  else Sound.play('news');
  Sound.music('campaign');
}

// ---------------- coalition ----------------
function renderCoalition() {
  const c = G.coal, t = coalTotals();
  const k = c.kingmakers.find(x => !x.side && !x.tried);
  return `<div class="screen">
    ${topbar([`🤝 Find friends · Try ${Math.min(c.round, c.rounds)}/${c.rounds}`])}
    ${tug(t.you, t.A)}
    ${k ? `<div class="stage">
      <div class="bigcard flipin"><div class="kicker">They can make you win!</div><div class="emo wobble">🤝</div><h2>${esc(k.short)}</h2><p>This party has <b>${k.seats} seats</b>. Will they be your friend?</p></div>
      <div class="answers">
        <button class="gbtn blue pop-in" data-a="offer" data-k="${k.key}" data-o="ask">🙏 Just ask</button>
        <button class="gbtn orange pop-in" data-a="offer" data-k="${k.key}" data-o="berth" ${c.berths ? '' : 'disabled'}>🏛️ Make them minister</button>
        <button class="gbtn green pop-in" data-a="offer" data-k="${k.key}" data-o="package">🎁 Give money to their state</button>
      </div></div>`
    : `<div class="stage"><div class="bigcard"><div class="emo spin">⏳</div><h2>Waiting for the others…</h2></div></div><div class="bottom"><button class="gbtn green big glow" data-a="coalround">NEXT ▶</button></div>`}
  </div>`;
}

// ---------------- governance ----------------
function meterValues() {
  const e = G.eco;
  return [(overallApproval() - 25) / 45, (e.growth - 2) / 7, 1 - (e.infl - 3.5) / 6, 1 - (e.deficit - 3.5) / 4.5].map(v => clamp(v, 0, 1));
}
const METERS = [['😀', 'Happy'], ['🏭', 'Jobs'], ['🛒', 'Prices'], ['🐷', 'Savings']];
const meterColor = g => g >= .6 ? '#4ade80' : g >= .35 ? '#facc15' : '#f87171';

function meters() {
  const now = meterValues(), prev = UI.meterPrev || now;
  return `<div class="meters" data-a="stats">${METERS.map(([icon, label], i) =>
    `<div class="meter" data-v="${now[i]}"><div class="mfill"><i style="height:${Math.max(6, prev[i] * 100)}%;background:${meterColor(prev[i])}"></i><span>${icon}</span></div><small>${label}</small></div>`).join('')}</div>`;
}

function animateMeters() {
  const els = document.querySelectorAll('.meter');
  if (!els.length) { UI.meterPrev = null; return; }
  const now = meterValues(), prev = UI.meterPrev || now;
  requestAnimationFrame(() => els.forEach((el, i) => {
    const bar = el.querySelector('i');
    bar.style.height = Math.max(6, now[i] * 100) + '%'; bar.style.background = meterColor(now[i]);
    const d = now[i] - prev[i];
    if (Math.abs(d) > .03) {
      FX.floatText(el, d > 0 ? '▲' : '▼', d > 0 ? '#bbf7d0' : '#fecaca');
      el.classList.add(d > 0 ? 'hop' : 'sad');
    }
  }));
  UI.meterPrev = now;
}

function renderGov() {
  const g = G.gov;
  if (!g.hand) dealHand();
  const ev = g.events[0];
  const budgetDue = isBudgetQuarter() && g.lastBudgetQ !== g.q;
  let stage;
  if (ev) stage = eventCard(GOV_EVENTS.find(x => x.id === ev.id), ev.ctx, 'gev');
  else if (budgetDue) stage = budgetStage();
  else if (!g.played && UI.card < g.hand.length) stage = ideaStage(g.hand[UI.card]);
  else stage = `<div class="stage"><div class="bigcard"><div class="emo spin">⏳</div><h2>Time passes…</h2></div></div><div class="bottom"><button class="gbtn green big glow" data-a="endq">NEXT ▶</button></div>`;
  return `<div class="screen">
    ${topbar([`📅 Year ${Math.floor(g.q / 4) + 1}/5`, `⭐ <b class="energy">${g.pc}</b>`])}
    ${meters()}
    ${stage}
  </div>`;
}

function budgetStage() {
  const icons = { populist: 'green', balanced: 'blue', growth: 'orange', austerity: 'red' };
  return `<div class="stage">
    <div class="bigcard flipin"><div class="kicker">Once a year</div><div class="emo wobble">💰</div><h2>Money Day!</h2><p>How will you use India's money this year?</p></div>
    <div class="grid2">${Object.entries(BUDGET_PRESETS).map(([k, p], i) => `<button class="gbtn ${icons[k]} pop-in" style="animation-delay:${200 + i * 80}ms" data-a="preset" data-k="${k}">${p.icon} ${p.name}</button>`).join('')}</div>
    <p class="tiny">Gifts make people happy now. Saving keeps India safe later.</p>
  </div>`;
}

function ideaStage(c) {
  const g = G.gov;
  let icon, title, desc, extra = '', cost, can;
  if (c.type === 'pm') {
    const a = PM_ACTIONS[c.id];
    icon = a.icon; title = a.name; desc = a.desc; cost = a.pc; can = g.pc >= a.pc && !g[a.once];
  } else {
    const r = REFORMS.find(x => x.id === c.id), st = billStatus(r.id);
    const promised = g.promises.some(id => PROMISES.find(p => p.id === id).check.toString().includes(`'${r.id}'`));
    icon = REFORM_ICON[r.id] || '📜'; title = r.name; desc = r.desc; cost = r.pc; can = g.pc >= r.pc;
    extra = `${promised ? '<div class="promised">📜 You promised this!</div>' : ''}${fans(r.blocs)}${st.objectors.length ? `<div class="warnline">😠 ${st.objectors.map(a => a.short).join(', ')} won't like it</div>` : ''}`;
  }
  return `<div class="stage">
    <div class="deck"><div class="ghost-card g2"></div><div class="ghost-card g1"></div>
    <div class="bigcard swipe flipin" data-can="${can ? 1 : 0}">
      <div class="stamp yes">YES</div><div class="stamp no">NO</div>
      <span class="costtag ${can ? '' : 'poor'}">${cost} ⭐</span>
      <div class="kicker">Idea ${UI.card + 1} of ${g.hand.length}</div>
      <div class="emo">${icon}</div><h2>${title}</h2><p>${desc}</p>${extra}
    </div></div>
    <div class="yesno">
      <button class="round red" data-a="skipcard" aria-label="No">✖</button>
      <span class="tiny">${can ? 'NO ← swipe → YES' : 'Need more ⭐ energy'}</span>
      <button class="round green ${can ? 'glow' : ''}" data-a="playcard" ${can ? '' : 'disabled'} aria-label="Yes">✔</button>
    </div>
  </div>`;
}

// ---------------- end screens ----------------
function renderReport() {
  const r = G.report;
  return `<div class="screen title">
    <div class="sky"></div>
    <div class="logo-art">📋</div><h2 class="white">5 years done!</h2>
    <div class="bigcard flipin">
      <p>😀 People happy: <b>${r.approval}%</b></p>
      <p>✅ Promises kept <b>${r.kept.length}</b> · ❌ broken <b>${r.broken.length}</b></p>
    </div>
    <div class="spacer"></div>
    <button class="gbtn green big glow" data-a="reelect">ELECTION TIME ▶</button>
  </div>`;
}

function renderGameOver() {
  const L = legacyScore();
  const lostFirst = G.quartersAsPM === 0;
  return `<div class="screen title">
    <div class="sky"></div>
    <div class="logo-art">${lostFirst ? '😢' : '🏆'}</div>
    <h2 class="white">${lostFirst ? 'So close! Try again.' : `You ruled for ${L.yrs} years!`}</h2>
    <div class="bigcard flipin"><small>YOUR TITLE</small><h2>${L.title}</h2><div class="score">⭐ <b class="final-score">${L.score}</b></div></div>
    <div class="spacer"></div>
    <button class="gbtn green big glow" data-a="newgame">PLAY AGAIN ▶</button>
  </div>`;
}

// ---------------- router ----------------
function musicFor() {
  if (!G || UI.screen !== 'game') return 'title';
  if (G.phase === 'campaign') return 'campaign';
  if (G.phase === 'results') return UI.reveal && UI.reveal.n >= STATES.length ? 'campaign' : 'tense';
  if (G.phase === 'coalition') return 'tense';
  if (G.phase === 'gov') return 'gov';
  return 'title';
}

function render() {
  let html;
  if (UI.screen === 'setup') html = renderSetup();
  else if (!G || UI.screen === 'title') html = renderTitle();
  else if (G.phase === 'campaign') html = renderCampaign();
  else if (G.phase === 'results') html = renderResults();
  else if (G.phase === 'coalition') html = renderCoalition();
  else if (G.phase === 'gov') html = renderGov();
  else if (G.phase === 'termreport') html = renderReport();
  else html = renderGameOver();
  $('#view').innerHTML = html;
  bindSwipe();
  FX.sky($('.sky'));
  animateTug(G && G.phase === 'results' ? 200 : 800);
  animateMeters();
  const fs = $('.final-score'); if (fs) FX.countUp(fs, 0, +fs.textContent, 1500);
  Sound.music(musicFor());
  // ring a bell when a new news card appears
  const ev = G && UI.screen === 'game' && ((G.phase === 'campaign' && G.camp.event) || (G.phase === 'gov' && G.gov.events[0]));
  const key = ev ? ev.id + JSON.stringify(ev.ctx) + (G.camp ? G.camp.week : '') + (G.gov ? G.gov.q : '') : null;
  if (key && key !== UI.lastEvent) { Sound.play(G.phase === 'gov' ? 'alarm' : 'news'); if (G.phase === 'gov') FX.shake(); }
  else if ($('.swipe') || $('.bigcard.flipin')) Sound.play('flip');
  UI.lastEvent = key;
}

function openModal(html) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal-bg'; m.id = 'popup';
  m.innerHTML = `<div class="modal">${html}</div>`;
  $('#app').appendChild(m);
}
function closeModal() { const m = $('#popup'); if (m) m.remove(); }

// Drag the idea card: right = yes, left = no.
function bindSwipe() {
  const card = $('.swipe');
  if (!card) return;
  let x0 = null, dx = 0;
  const can = card.dataset.can === '1';
  card.addEventListener('pointerdown', e => { if (UI.busy) return; x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; card.style.animation = 'none'; });
  card.addEventListener('pointermove', e => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    if (!can && dx > 0) dx = Math.min(dx, 30);
    card.style.transform = `translateX(${dx}px) rotate(${dx / 16}deg)`;
    card.querySelector('.yes').style.opacity = clamp(dx / 80, 0, 1);
    card.querySelector('.no').style.opacity = clamp(-dx / 80, 0, 1);
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    card.style.transition = 'transform .25s';
    if (dx > 80 && can) run(() => decideIdea(true, card));
    else if (dx < -80) run(() => decideIdea(false, card));
    else { card.style.transform = ''; card.querySelectorAll('.stamp').forEach(s => { s.style.opacity = 0; }); }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

async function flyOut(card, dir) {
  buzz(15); Sound.play('swipe');
  card.style.transition = 'transform .3s ease-in';
  card.style.animation = 'none';
  card.style.transform = `translateX(${dir * 560}px) rotate(${dir * 30}deg)`;
  await wait(260);
}

// Run an animated sequence; taps are ignored until it finishes.
async function run(fn) {
  if (UI.busy) return;
  UI.busy = true;
  try { await fn(); } finally { UI.busy = false; }
}

// ---------------- animated sequences ----------------

// How good a choice turned out, judged from what changed (positive = good).
function moodSnapshot() {
  if (G.phase === 'gov') return BLOCS.reduce((t, b) => t + G.gov.blocMods[b.id], 0) + G.trust + G.gov.allies.reduce((t, a) => t + a.sat, 0) * .2;
  if (G.camp) return G.camp.momentum * 2 + G.trust + BLOCS.reduce((t, b) => t + G.appeal.you[b.id], 0) - G.camp.momA;
  return 0;
}

async function campaignMove(i, btn) {
  const c = UI.deal[i], C = G.camp, s = c.s && stateById(c.s);
  const before = livePoll().youBloc, trust0 = G.trust;
  // the chosen card pops forward, the others slide away
  document.querySelectorAll('.mcard').forEach(el => el.classList.add(el === btn ? 'picked' : 'away'));
  buzz(15);
  await wait(380);
  if (c.k === 'alliance') {
    Sound.play('drumroll');
    await FX.burst('🤝', `Asking ${s.reg.short}…`, 'wait', '🤞🤞🤞');
  }
  const r = campaignAction(c.k, c.s, false);
  if (r.err) { UI.deal = null; return handle(r); }
  UI.live = pollSnapshot();
  const gain = UI.live.youBloc - before, seats = gain > 0 ? `+${gain} seats!` : '';
  if (c.k === 'rally') { Sound.play('cheer'); await FX.burst('📣', `Big crowd in ${s.name}!`, 'good', seats || '🙌 People love you'); }
  if (c.k === 'alliance') {
    if (C.alliances[c.s] === 'you') { Sound.play('win'); await FX.burst('🎉', `${s.reg.short} is your friend!`, 'good', seats || `${s.name} is with you`); }
    else { Sound.play('bad'); await FX.burst('😕', 'They said no…', 'bad', 'Try again later'); }
  }
  if (c.k === 'ads') { Sound.play('tv'); await FX.burst('📺', 'Everyone saw your ad!', 'good', seats); }
  if (c.k === 'fundraise') {
    Sound.play('coin');
    const money = $('.money');
    await FX.fly('🪙', btn, money, 8);
    if (money) { FX.countUp(money, Math.round(C.funds) - 50, Math.round(C.funds), 500); money.parentElement.classList.add('hop'); }
  }
  if (c.k === 'attack') {
    Sound.play('sword');
    await wait(250);
    if (G.trust < trust0) { Sound.play('bad'); await FX.burst('😬', 'Oops! That went wrong.', 'bad'); }
    else { Sound.play('good'); await FX.burst('⚔️', 'RSP looks bad!', 'good', seats); }
  }
  UI.deal = null;
  if (G.camp.ap === 0) return endOfWeek();
  render();
}

async function endOfWeek() {
  const C = G.camp;
  const before = livePoll();
  const w = endWeek();
  if (w.err) return toast(w.err, 'bad');
  if (w.election) {
    UI.live = null; UI.reveal = null; UI.tugPrev = null;
    await FX.banner('🗳️ ELECTION DAY!', 'Let\'s count the votes', 'gold', 1500);
    return render();
  }
  // the rival takes its turn
  const moves = (C.rivalMoves || []).slice(0, 3);
  const line = m => {
    const s = m.s && stateById(m.s);
    if (m.k === 'ads') return '📺 RSP showed TV ads';
    if (m.k === 'rally') return `📣 RSP held a rally in ${s.name}`;
    if (m.k === 'ally') return `🤝 RSP made friends in ${s.name}!`;
    if (m.k === 'steal') return `💔 RSP stole your friend in ${s.name}!`;
    return '';
  };
  const hurt = moves.some(m => m.k === 'ally' || m.k === 'steal');
  Sound.play('down');
  await FX.burst(RIVAL_FACE, "RSP's turn!", hurt ? 'bad' : 'rival', moves.map(line).join('<br>') || 'RSP is planning…');
  UI.live = null;
  const after = livePoll(), d = after.youBloc - before.youBloc;
  UI.tugPrev = { you: before.youBloc, A: before.aBloc };
  await FX.banner(`WEEK ${C.week}`, d >= 0 ? `📈 Poll: you +${d} seats` : `📉 Poll: you ${d} seats`, d >= 0 ? 'green' : 'red');
  Sound.play(d >= 0 ? 'up' : 'down');
  render();
}

async function choosePromise(id, btn) {
  document.querySelectorAll('.mcard').forEach(el => el.classList.add(el === btn ? 'picked' : 'away'));
  Sound.play('stamp'); buzz(15);
  await wait(450);
  UI.picked = (UI.picked || []).concat(id); UI.pdeal = null;
  if (UI.picked.length === 3) {
    choosePromises(UI.picked); UI.picked = [];
    UI.live = null;
    Sound.play('cheer');
    await FX.burst('📣', 'Promises announced!', 'good', 'The campaign begins!');
    await FX.banner('WEEK 1', 'Get 272 seats to win 👑', 'gold');
  }
  render();
}

async function answerEvent(kind, i, btn) {
  const isGov = kind === 'gev';
  const ev = isGov ? G.gov.events[0] : G.camp.event;
  const icon = (isGov ? GOV_EVENTS : CAMPAIGN_EVENTS).find(e => e.id === ev.id).icon;
  btn.classList.add('chosen');
  const m0 = moodSnapshot();
  const r = isGov ? resolveGovEvent(i) : resolveCampaignEvent(i);
  if (r.err) { btn.classList.remove('chosen'); return toast(r.err, 'bad'); }
  buzz(15);
  if (r.phaseChange || G.phase !== (isGov ? 'gov' : 'campaign')) {
    UI.deal = null; UI.pdeal = null; UI.picked = []; UI.live = null; UI.tugPrev = null; UI.meterPrev = null;
    await FX.burst('🗳️', r.msg, 'bad');
    return render();
  }
  const good = moodSnapshot() >= m0;
  Sound.play(good ? 'good' : 'bad');
  await FX.burst(good ? icon : '😬', r.msg, good ? 'good' : 'bad');
  if (!isGov) { UI.deal = null; UI.live = pollSnapshot(); }
  render();
}

async function decideIdea(yes, card) {
  const g = G.gov;
  if (!yes) {
    await flyOut(card, -1);
    UI.card++;
    if (UI.card >= g.hand.length) return finishQuarter();
    return render();
  }
  const r = playCard(UI.card);
  if (r.err) { toast(r.err, 'bad'); return render(); }
  card.style.animation = 'none';
  card.style.transform = '';
  const stamp = document.createElement('div');
  stamp.className = 'bigstamp ' + (r.fail ? 'no' : 'yes');
  stamp.textContent = r.fail ? 'FAILED' : 'PASSED!';
  card.appendChild(stamp);
  Sound.play('stamp'); buzz(30);
  await wait(350);
  if (r.fail) { Sound.play('bad'); FX.shake(); } else { Sound.play('good'); FX.confetti(70); }
  await wait(900);
  await flyOut(card, 1);
  await finishQuarter();
}

async function finishQuarter() {
  const before = overallApproval();
  const r = endQuarter();
  if (r.err) { toast(r.err, 'bad'); return render(); }
  UI.card = 0;
  if (G.phase === 'gov') {
    const d = overallApproval() - before;
    await FX.banner(`📅 ${quarterLabel(G.calQ)}`, d >= 0 ? '😀 People are happier!' : '😟 People are less happy', d >= 0 ? 'green' : 'red');
  } else if (G.phase === 'termreport') {
    Sound.play('win');
    await FX.banner('🏁 5 YEARS DONE!', 'Time for the next election', 'gold', 1500);
  } else {
    UI.tugPrev = null; UI.meterPrev = null;
  }
  render();
}

async function budgetChoice(k, btn) {
  btn.classList.add('chosen');
  const r = budgetPreset(k);
  if (r.err) return handle(r);
  Sound.play('coin');
  await FX.fly('🪙', btn, $('.meters'), 8);
  const p = BUDGET_PRESETS[k];
  Sound.play('good');
  await FX.burst(p.icon, `${p.name}!`, 'good', 'Money Day is done');
  render();
}

async function coalitionOffer(key, offer, btn) {
  const k = G.coal.kingmakers.find(x => x.key === key);
  btn.classList.add('chosen');
  Sound.play('drumroll');
  await FX.burst('🤝', `Asking ${k.short}…`, 'wait', '🤞🤞🤞');
  const r = coalOffer(key, offer); save();
  if (r.err) return handle(r);
  if (k.side === 'you') { Sound.play('win'); await FX.burst('🎉', `${k.short} joins you!`, 'good', `+${k.seats} seats`); }
  else { Sound.play('bad'); await FX.burst('😕', `${k.short} said no.`, 'bad'); }
  render();
}

const ACTIONS = {
  continue() { if (load()) { UI.screen = 'game'; UI.deal = null; UI.card = 0; UI.live = null; UI.tugPrev = null; UI.meterPrev = null; render(); } },
  newgame() { UI.setup = { leader: '', symbol: PARTY_SYMBOLS[0], color: PARTY_COLORS[0] }; UI.screen = 'setup'; G = null; render(); },
  help() { openModal(helpHTML()); },
  closemodal() { closeModal(); },
  setsym(d) { UI.setup.leader = $('#f-leader').value; UI.setup.symbol = d.v; UI.setup.color = d.c; buzz(8); Sound.play('up'); render(); },
  start() {
    const name = ($('#f-leader').value || '').trim() || 'Asha Verma';
    const s = UI.setup;
    newGame({ leader: name, party: 'Jan Shakti Party', short: 'JSP', symbol: s.symbol, color: s.color, ideology: 'centrist', difficulty: 'normal' });
    UI.screen = 'game'; UI.reveal = null; UI.deal = null; UI.pdeal = null; UI.picked = []; UI.card = 0; UI.live = null; UI.tugPrev = null; UI.meterPrev = null;
    render();
    let seen = false; try { seen = !!localStorage.getItem('rajneeti.seenHelp'); localStorage.setItem('rajneeti.seenHelp', '1'); } catch (e) { /* ignore */ }
    if (!seen) openModal(helpHTML());
  },
  promise(d, el) { run(() => choosePromise(d.id, el)); },
  move(d, el) { run(() => campaignMove(+d.i, el)); },
  cev(d, el) { run(() => answerEvent('cev', +d.i, el)); },
  gev(d, el) { run(() => answerEvent('gev', +d.i, el)); },
  skipreveal() {
    clearTimeout(UI.reveal.timer); UI.reveal.n = 999;
    render(); finishReveal();
  },
  afterresults() {
    UI.reveal = null; afterResults(); save(); UI.card = 0; UI.tugPrev = null; UI.meterPrev = null; render();
    if (G.phase === 'gov') welcomePM();
  },
  offer(d, el) { run(() => coalitionOffer(d.k, d.o, el)); },
  coalround() { coalEndRound(); save(); UI.card = 0; UI.meterPrev = null; render(); if (G.phase === 'gov') welcomePM(); },
  preset(d, el) { run(() => budgetChoice(d.k, el)); },
  playcard() { const card = $('.swipe'); if (card) run(() => decideIdea(true, card)); },
  skipcard() { const card = $('.swipe'); if (card) run(() => decideIdea(false, card)); },
  endq() { run(finishQuarter); },
  stats() {
    const e = G.eco;
    openModal(`<h2>🇮🇳 India</h2>
      <div class="srow"><span>😀 Are people happy?</span><b>${word(overallApproval() >= 50, overallApproval() >= 40)}</b></div>
      <div class="srow"><span>🏭 Are there jobs?</span><b>${word(e.growth >= 6, e.growth >= 4)}</b></div>
      <div class="srow"><span>🛒 Are prices OK?</span><b>${word(e.infl <= 4.5, e.infl <= 6.5)}</b></div>
      <div class="srow"><span>🐷 Is India saving money?</span><b>${word(e.deficit <= 4.5, e.deficit <= 6.5)}</b></div>
      <h3>Who is happy?</h3>${BLOCS.map(b => { const v = G.gov.approval[b.id]; return `<div class="srow"><span>${b.icon} ${b.name}</span><b>${v >= 55 ? '😀' : v >= 42 ? '😐' : '😠'}</b></div>`; }).join('')}
      ${G.gov.promises.length ? `<h3>Promises</h3>${G.gov.promises.map(id => `<div class="srow"><span>${PROMISES.find(x => x.id === id).check(G) ? '✅' : '⏳'} ${PROMISES.find(x => x.id === id).name}</span></div>`).join('')}` : ''}
      <button class="gbtn green" data-a="closemodal">OK</button>`);
  },
  allies() {
    const g = G.gov;
    openModal(`<h2>🤝 Friends</h2>${g.allies.map(a => `<div class="srow"><span>${a.sat >= 50 ? '😀' : a.sat >= 30 ? '😐' : '😠'} ${esc(a.short)} · ${a.seats} seats</span><button class="gbtn small orange" data-a="pkggo" data-k="${a.key}" ${g.pc < 1 ? 'disabled' : ''}>🎁 1⭐</button></div>`).join('') || '<p>No allies.</p>'}
      <button class="gbtn green" data-a="closemodal">OK</button>`);
  },
  pkggo(d) { const r = allyPackage(d.k); if (r.err) return handle(r); Sound.play('good'); toast('🎁 Your friend is happy!', 'good'); render(); },
  reelect() { goToElection(false); UI.deal = null; UI.pdeal = null; UI.picked = []; UI.live = null; UI.tugPrev = null; render(); },
  menu() {
    openModal(`<h2>Menu</h2><div class="answers">
      <button class="gbtn blue" data-a="soundmenu">🔊 Sound</button>
      <button class="gbtn blue" data-a="help">📖 How to play</button>
      ${G && G.phase === 'gov' ? '<button class="gbtn blue" data-a="allies">🤝 My friends</button>' : ''}
      <button class="gbtn orange" data-a="quit">🏠 Save & exit</button>
      <button class="gbtn green" data-a="closemodal">▶ Resume</button></div>`);
  },
  mute() {
    const m = Sound.toggleMute();
    document.querySelectorAll('[data-a=mute]').forEach(b => { b.textContent = m ? '🔇' : '🔊'; });
    toast(m ? '🔇 Sound off' : '🔊 Sound on');
  },
  soundmenu() {
    const s = Sound.settings, pct = v => Math.round(v * 100);
    openModal(`<h2>🔊 Sound</h2>
      <label class="vol" for="vol-sfx"><span>🎵 Game sounds</span><input id="vol-sfx" type="range" min="0" max="100" value="${pct(s.sfx)}"></label>
      <label class="vol" for="vol-music"><span>🎶 Music</span><input id="vol-music" type="range" min="0" max="100" value="${pct(s.music)}"></label>
      <button class="gbtn ${s.muted ? 'green' : 'orange'}" data-a="mute">${s.muted ? '🔊 Turn sound on' : '🔇 Turn all sound off'}</button>
      <button class="gbtn green" data-a="closemodal">OK</button>`);
  },
  quit() { save(); UI.screen = 'title'; G = null; render(); },
};

function welcomePM() {
  Sound.play('win'); FX.confetti(150);
  openModal(`<div class="center"><div class="emo wobble">🇮🇳</div><h2>You are Prime Minister!</h2>
    <p>Ideas will come to you.<br><b>Swipe right = YES</b> · <b>left = NO</b></p>
    <p>Keep the 4 meters green! 🟩</p><p>Each idea needs ⭐ energy. Happy people give you more.</p><button class="gbtn green glow" data-a="closemodal">LET'S GO ▶</button></div>`);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  Sound.unlock();
  const a = el.dataset.a;
  if (UI.busy && a !== 'mute') return;
  if (a !== 'mute') Sound.play('tap');
  if ($('#popup')) { if (!el.closest('#popup')) return; closeModal(); }
  ACTIONS[a] && ACTIONS[a](el.dataset, el);
});

// Volume sliders change the sound as you drag; play a sample so the level is easy to judge.
document.addEventListener('input', e => {
  if (e.target.id === 'vol-sfx') { Sound.set('sfx', e.target.value / 100); Sound.play('tap'); }
  if (e.target.id === 'vol-music') Sound.set('music', e.target.value / 100);
});
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

render();
