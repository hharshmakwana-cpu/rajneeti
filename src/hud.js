// RAJNEETI 3D — everything on top of the 3D town: resources, shop, building panel,
// collect bubbles, the RSP jeep chase, elections, tutorial and title screen.

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.floor(n));
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6'];
const SYMBOLS = ['🦚', '☀️', '🌳', '🪔', '🦁', '⭐'];

const H = { mode: 'title', placing: null, ghostAt: null, selected: null, busy: false, previews: {}, bubbles: new Map(), lastBuilt: new Map(), started: false };

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + kind;
  clearTimeout(H.toastT);
  H.toastT = setTimeout(() => { t.className = 'toast'; }, 2200);
}

// ---------------- title and setup ----------------
function showTitle() {
  H.mode = 'title';
  Sound.music('title');
  $('#screen').innerHTML = `<div class="title">
    ${H.started ? '' : '<button class="tapstart" data-a="tapstart"><span class="ts-emo">🥁</span><b>TAP TO START</b><small>🔊 Sound on</small></button>'}
    <div class="logo-wrap"><div class="logo-art">🏛️</div><h1 class="logo">${'RAJNEETI'.split('').map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join('')}</h1>
    <p class="sub">Build your party. Win elections. Become PM!</p></div>
    <div class="spacer"></div>
    ${hasSave() ? '<button class="gbtn green big glow" data-a="continue">▶ CONTINUE</button>' : ''}
    <button class="gbtn ${hasSave() ? 'blue' : 'green glow'} big" data-a="newgame">${hasSave() ? 'NEW GAME' : '▶ PLAY'}</button>
  </div>`;
}

function showSetup() {
  H.mode = 'setup';
  H.setup = H.setup || { symbol: SYMBOLS[0], color: COLORS[0] };
  const s = H.setup;
  $('#screen').innerHTML = `<div class="title setup">
    <div class="hero-av" style="background:${s.color}">${s.symbol}</div>
    <h2>What's your name, leader?</h2>
    <input id="f-name" class="bigin" maxlength="18" placeholder="Your name" value="${esc(s.name || '')}">
    <p>Party symbol</p>
    <div class="symbols">${SYMBOLS.map((x, i) => `<button class="symb ${s.symbol === x ? 'on' : ''}" style="background:${COLORS[i]}" data-a="sym" data-i="${i}">${x}</button>`).join('')}</div>
    <div class="spacer"></div>
    <button class="gbtn green big glow" data-a="begin">BUILD MY PARTY ▶</button>
  </div>`;
}

// ---------------- the town HUD ----------------
function startTown() {
  H.mode = 'town';
  $('#screen').innerHTML = '';
  $('#hud').hidden = false;
  World.sync(S);
  const h = hq(); World.focus(h.x, h.z, 2);
  Sound.music('gov');
  renderHUD();
  const away = Date.now() - (S.lastSeen || Date.now());
  if (away > 120000 && S.buildings.length > 1) setTimeout(() => FX.banner('👋 Welcome back!', 'Your town kept working while you were away', 'gold', 1600), 400);
  tutorial();
}

function renderHUD() {
  const e = election(), pct = Math.min(1, S.votes / e.votes);
  $('#hud').innerHTML = `
    <div class="topbar">
      <div class="rankcard" data-a="rankinfo"><span class="av" style="background:${S.color}">${S.symbol}</span>
        <div><b>${esc(S.leader)}</b><small>${RANKS[S.rank].title}</small></div></div>
      <div class="res"><span class="pill" id="p-coins">💰 <b>${fmt(S.coins)}</b></span><span class="pill" id="p-votes">🗳️ <b>${fmt(S.votes)}</b></span><span class="pill" id="p-workers">👷 <b>${workersFree()}/${workersTotal()}</b></span></div>
    </div>
    <div class="side">
      <button class="round-btn" data-a="mute" aria-label="Sound">${Sound.settings.muted ? '🔇' : '🔊'}</button>
      <button class="round-btn" data-a="menu" aria-label="Menu">☰</button>
    </div>
    ${H.placing ? `<div class="placebar"><b>Tap a green spot for your ${BUILDINGS[H.placing].name}</b>
      <div class="row"><button class="gbtn red" data-a="cancelplace">✖ Cancel</button>${H.ghostAt ? `<button class="gbtn green glow" data-a="confirmplace">✔ Build here</button>` : ''}</div></div>`
    : `<div class="bottombar">
      <button class="big-btn build" data-a="shop"><span>🏗️</span><b>BUILD</b></button>
      <button class="big-btn vote ${electionReady() ? 'ready glow' : ''}" data-a="election">
        <svg viewBox="0 0 36 36" class="ring"><circle cx="18" cy="18" r="15.5"/><circle cx="18" cy="18" r="15.5" class="fill" style="stroke-dasharray:${(pct * 97.4).toFixed(1)} 97.4"/></svg>
        <span>🗳️</span><b>${electionReady() ? 'ELECTION!' : `${Math.floor(pct * 100)}%`}</b></button>
    </div>`}
    <div id="hint" class="hint" hidden></div>`;
  tutorial(true);
}

function updateCounters() {
  const set = (id, v) => { const el = $(`#${id} b`); if (el && el.textContent !== v) { el.textContent = v; el.parentElement.classList.remove('hop'); void el.offsetWidth; el.parentElement.classList.add('hop'); } };
  set('p-coins', fmt(S.coins)); set('p-votes', fmt(S.votes)); set('p-workers', `${workersFree()}/${workersTotal()}`);
  const v = $('.big-btn.vote');
  if (v) {
    const e = election(), pct = Math.min(1, S.votes / e.votes);
    v.querySelector('.fill').style.strokeDasharray = `${(pct * 97.4).toFixed(1)} 97.4`;
    v.querySelector('b').textContent = electionReady() ? 'ELECTION!' : `${Math.floor(pct * 100)}%`;
    v.classList.toggle('ready', electionReady()); v.classList.toggle('glow', electionReady());
  }
}

// ---------------- bubbles over buildings ----------------
function refreshBubbles() {
  const layer = $('#bubbles');
  const want = new Map();
  for (const b of S.buildings) {
    if (!built(b)) want.set(b.id, { kind: 'timer', text: '⏱ ' + clock(b.doneAt - Date.now()) });
    else if (isReady(b)) want.set(b.id, { kind: BUILDINGS[b.type].makes, text: BUILDINGS[b.type].makes === 'coins' ? '💰' : '🗳️' });
  }
  for (const [id, el] of H.bubbles) if (!want.has(id) || want.get(id).kind !== el.dataset.kind) { el.remove(); H.bubbles.delete(id); }
  for (const [id, w] of want) {
    let el = H.bubbles.get(id);
    if (!el) {
      el = document.createElement('button');
      el.className = `bubble ${w.kind}`; el.dataset.kind = w.kind; el.dataset.id = id;
      el.dataset.a = w.kind === 'timer' ? 'select' : 'collect';
      layer.appendChild(el); H.bubbles.set(id, el);
    }
    if (el.textContent !== w.text) el.textContent = w.text;
  }
}

function placeBubbles() {
  for (const [id, el] of H.bubbles) {
    const a = World.anchor(id);
    if (!a) { el.style.display = 'none'; continue; }
    const p = World.project(a);
    el.style.display = p.behind ? 'none' : '';
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  }
}

async function collectAt(id, el) {
  const r = collect(id);
  if (!r) return;
  buzz(10);
  Sound.play(r.kind === 'coins' ? 'coin' : 'pop');
  World.jiggle(id);
  const target = $(r.kind === 'coins' ? '#p-coins' : '#p-votes');
  FX.floatText(el, `+${r.amount}`, r.kind === 'coins' ? '#ffd166' : '#ffffff');
  FX.fly(r.kind === 'coins' ? '🪙' : '🗳️', el, target, 4);
  el.remove(); H.bubbles.delete(id);
  setTimeout(updateCounters, 500);
  if (S.tutorial === 2) { S.tutorial = 3; tutorial(); }
}

// ---------------- shop ----------------
function preview(type) {
  if (H.previews[type]) return H.previews[type];
  try {
    if (!H.pr) {
      H.pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      H.pr.setSize(160, 160);
      H.pr.outputEncoding = THREE.sRGBEncoding;
      H.ps = new THREE.Scene();
      H.ps.add(new THREE.HemisphereLight('#ffffff', '#88aa66', 1.1));
      const l = new THREE.DirectionalLight('#fff4e0', 1.6); l.position.set(3, 5, 4); H.ps.add(l);
      H.pc = new THREE.PerspectiveCamera(30, 1, .1, 50);
    }
    const g = Models.build(type, 1, S.color), size = BUILDINGS[type].size;
    H.ps.add(g);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length();
    H.pc.position.set(c.x + r * 1.3, c.y + r * 1.1, c.z + r * 1.6); H.pc.lookAt(c);
    H.pr.render(H.ps, H.pc);
    H.previews[type] = H.pr.domElement.toDataURL();
    H.ps.remove(g);
    void size;
  } catch (e) { H.previews[type] = ''; }
  return H.previews[type];
}

function openShop() {
  Sound.play('flip');
  sheet(`<div class="sheet-h"><b>🏗️ Build</b><button class="x" data-a="closesheet">✕</button></div>
    <div class="shop">${SHOP_ORDER.map(type => {
      const d = BUILDINGS[type], st = shopStatus(type), img = preview(type);
      const tag = d.makes ? `${d.makes === 'coins' ? '💰' : '🗳️'} +${d.amount} / ${d.every}s` : d.workers ? '👷 +1 worker' : d.boost ? '📡 +20% voters' : `🌿 +${Math.round(d.deco * 100)}% voters`;
      return `<button class="item ${st.locked ? 'locked' : ''} ${st.poor ? 'poor' : ''}" data-a="buy" data-t="${type}" ${st.locked ? 'disabled' : ''}>
        ${img ? `<img src="${img}" alt="">` : `<span class="ico">${d.icon}</span>`}
        <b>${d.name}</b><small>${tag}</small>
        <span class="price">${st.locked ? '🔒 ' + st.why : `💰 ${d.cost}${d.build > 3 ? ` · ⏱ ${clock(d.build * 1000)}` : ''}`}</span></button>`;
    }).join('')}</div>`);
}

function sheet(html) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-bg'; el.id = 'sheet';
  el.innerHTML = `<div class="sheet">${html}</div>`;
  $('#app').appendChild(el);
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }

function startPlacing(type) {
  const st = shopStatus(type);
  if (st.poor) return toast('💰 Not enough coins', 'bad');
  if (st.busy) return toast('👷 All workers are busy — wait or build a Karyakarta Bhavan', 'bad');
  closeSheet();
  H.placing = type; H.ghostAt = null;
  // suggest the first free spot near the Party Office
  const h = hq(), size = BUILDINGS[type].size;
  let best = null;
  for (let x = 0; x < landSize(); x++) for (let z = 0; z < landSize(); z++) if (canPlace(type, x, z)) {
    const d = Math.hypot(x - h.x - 1, z - h.z - 1);
    if (!best || d < best.d) best = { x, z, d };
  }
  if (best) { H.ghostAt = best; World.setGhost(type, best.x, best.z, true); World.focus(best.x, best.z, size); }
  renderHUD();
}

function tapTile(x, z) {
  if (H.placing) {
    const size = BUILDINGS[H.placing].size;
    x = Math.min(x, landSize() - size); z = Math.min(z, landSize() - size);
    const ok = canPlace(H.placing, x, z);
    H.ghostAt = ok ? { x, z } : null;
    World.setGhost(H.placing, x, z, ok);
    Sound.play(ok ? 'tap' : 'oops');
    renderHUD();
    return;
  }
  closeSheet();
}

function confirmPlace() {
  if (!H.placing || !H.ghostAt) return;
  const r = place(H.placing, H.ghostAt.x, H.ghostAt.z);
  if (r.err) { toast(r.err, 'bad'); return; }
  Sound.play('stamp'); buzz(20);
  World.setGhost(null); H.placing = null; H.ghostAt = null;
  World.sync(S);
  if (S.tutorial === 1) { S.tutorial = 2; }
  renderHUD(); refreshBubbles();
  tutorial();
}

function cancelPlace() { World.setGhost(null); H.placing = null; H.ghostAt = null; renderHUD(); }

// ---------------- building panel ----------------
function selectBuilding(id) {
  const b = S.buildings.find(q => q.id === id);
  if (!b) return;
  if (isReady(b)) { const el = H.bubbles.get(id); if (el) return collectAt(id, el); }
  H.selected = id;
  World.jiggle(id); Sound.play('flip');
  const d = BUILDINGS[b.type];
  const making = d.makes ? `${d.makes === 'coins' ? '💰' : '🗳️'} ${output(b)} every ${Math.round(cycleSecs(b))}s` : d.workers ? `👷 ${b.level} worker${b.level > 1 ? 's' : ''}` : d.boost ? `📡 +${Math.round(d.boost * b.level * 100)}% voters` : d.deco ? `🌿 +${Math.round(d.deco * 100)}% voters` : `Unlocks up to ${maxCount('chai')} of each building`;
  let actions = '';
  if (!built(b)) actions = `<button class="gbtn orange" data-a="rush" data-id="${b.id}">⚡ Finish now · 💰${rushCost(b)}</button>`;
  else {
    if (d.makes && !isReady(b)) actions += `<p class="mutedtxt">Next ${d.makes === 'coins' ? 'money' : 'voters'} in ${clock(b.readyAt - Date.now())}</p>`;
    if (b.level < MAX_LEVEL) actions += canUpgrade(b)
      ? `<button class="gbtn green" data-a="upgrade" data-id="${b.id}">⬆️ Upgrade to level ${b.level + 1} · 💰${upgradeCost(b)} · ⏱${clock(upgradeTime(b) * 1000)}</button>`
      : `<button class="gbtn" disabled>🔒 ${b.type === 'hq' ? `Win the ${election().next} to upgrade` : 'Upgrade your Party Office first'}</button>`;
    if (b.type !== 'hq') actions += `<button class="gbtn ghost small" data-a="sell" data-id="${b.id}">Remove (get 💰${Math.floor(d.cost / 2)})</button>`;
  }
  sheet(`<div class="sheet-h"><b>${d.icon} ${d.name}</b><span class="lv">Level ${b.level}</span><button class="x" data-a="closesheet">✕</button></div>
    <div class="binfo">${preview(b.type) ? `<img src="${preview(b.type)}" alt="">` : ''}<div><p>${d.desc}</p><p class="making">${making}</p></div></div>
    ${actions}`);
}

// ---------------- election battle ----------------
async function startElection() {
  if (!electionReady()) {
    const e = election();
    toast(`🗳️ You need ${fmt(e.votes)} voters for the ${e.next}. You have ${fmt(S.votes)}.`, 'bad');
    return;
  }
  H.busy = true;
  const e = election();
  Sound.music('tense');
  const el = document.createElement('div');
  el.className = 'battle';
  el.innerHTML = `<div class="b-head"><small>${RANKS[S.rank].title} → ${S.rank < RANKS.length - 1 ? RANKS[S.rank + 1].title : 'Prime Minister again'}</small><h1>${e.next}</h1></div>
    <div class="vsrow"><div class="side-c"><span class="av big" style="background:${S.color}">${S.symbol}</span><b>${esc(S.leader)}</b></div><span class="vs">VS</span><div class="side-c"><span class="av big" style="background:#d64541">😈</span><b>RSP</b></div></div>
    <div class="cheer-zone"><p>Tap fast to cheer! Every cheer brings more voters 📣</p>
      <div class="cheerbar"><i></i></div>
      <button class="gbtn orange big cheer-btn">📣 CHEER!</button></div>`;
  $('#app').appendChild(el);
  await wait(400);
  // cheering mini-game: 5 seconds of tapping
  let taps = 0;
  const btn = el.querySelector('.cheer-btn'), bar = el.querySelector('.cheerbar i');
  const onTap = ev => { ev.preventDefault(); taps++; bar.style.width = Math.min(100, taps / 30 * 100) + '%'; Sound.play('pop'); buzz(5); btn.classList.remove('hop'); void btn.offsetWidth; btn.classList.add('hop'); };
  btn.addEventListener('pointerdown', onTap);
  await wait(5000);
  btn.removeEventListener('pointerdown', onTap);
  const res = runElection(Math.min(1, taps / 30));
  // the count
  el.querySelector('.cheer-zone').innerHTML = `<div class="count"><div><b class="c-me">0</b><small>your votes</small></div><div><b class="c-them">0</b><small>RSP votes</small></div></div><p class="counting">Counting votes…</p>`;
  Sound.play('drumroll');
  FX.countUp(el.querySelector('.c-me'), 0, res.mine, 2600);
  FX.countUp(el.querySelector('.c-them'), 0, res.theirs, 2600);
  for (let i = 0; i < 10; i++) { await wait(260); Sound.play('tick'); }
  await wait(300);
  if (res.win) {
    Sound.play('win'); FX.confetti(180); setTimeout(() => FX.confetti(140), 600);
    Sound.chant(`${S.leader} ज़िंदाबाद! ज़िंदाबाद!`);
    el.querySelector('.counting').outerHTML = `<div class="result win">🎉 YOU WON! 🎉<small>You are now <b>${res.rank}</b> · 💰 +${res.reward}</small></div>`;
  } else {
    Sound.play('lose'); FX.shake();
    el.querySelector('.counting').outerHTML = `<div class="result lose">😢 RSP won this time<small>Build more and try again!</small></div>`;
  }
  const done = document.createElement('button');
  done.className = 'gbtn green big glow'; done.textContent = 'BACK TO TOWN ▶';
  el.appendChild(done);
  await new Promise(r => done.addEventListener('click', r, { once: true }));
  el.remove();
  H.busy = false;
  Sound.music('gov');
  World.sync(S);
  const h = hq(); World.focus(h.x, h.z, 2);
  renderHUD(); refreshBubbles();
  if (res.win && S.rank === RANKS.length - 1 && S.wins === RANKS.length - 1) FX.banner('🇮🇳 PRIME MINISTER!', 'You did it! Keep building India', 'gold', 2500);
  else if (res.win) FX.banner(`⭐ ${res.rank}!`, 'New buildings and more land unlocked', 'gold', 1800);
  if (S.tutorial === 3) { S.tutorial = 4; save(); tutorial(); }
}

// ---------------- the RSP jeep ----------------
function jeepTapped(escaped) {
  if (!World.jeepActive) return;
  if (escaped) {
    World.stopJeep(false);
    const lost = jeepDone(false);
    if (lost) { toast(`😈 The RSP jeep took ${lost} voters!`, 'bad'); Sound.play('bad'); }
  } else {
    World.stopJeep(true);
    const got = jeepDone(true);
    Sound.play('win'); buzz(30);
    toast(`💥 You chased away the RSP jeep! +💰${got}`, 'good');
  }
  updateCounters();
}

// ---------------- tutorial ----------------
const TIPS = [
  '👋 Welcome! Tap 🏗️ BUILD to build your first Chai Stall',
  '☕ Pick the Chai Stall, then tap ✔ Build here',
  '⏳ Wait a moment, then tap the 🗳️ bubble to collect voters',
  '🗳️ Build more, collect voters, and when the ring is full tap ELECTION!',
];
function tutorial(quiet) {
  const h = $('#hint');
  if (!h || !S) return;
  if (S.tutorial === 0 && H.placing) S.tutorial = 1;
  const tip = TIPS[S.tutorial];
  h.hidden = !tip;
  if (tip) { h.textContent = tip; if (!quiet) { h.classList.remove('pop-in'); void h.offsetWidth; h.classList.add('pop-in'); } }
}

// ---------------- main loop ----------------
function tick() {
  if (H.mode !== 'town' || !S) return;
  // finished constructions pop into real buildings
  for (const b of S.buildings) {
    const was = H.lastBuilt.get(b.id), is = built(b);
    if (was === false && is) { World.sync(S); Sound.play('up'); toast(`✨ ${BUILDINGS[b.type].name} is ready!`, 'good'); renderHUD(); }
    H.lastBuilt.set(b.id, is);
  }
  refreshBubbles();
  updateCounters();
  if (!H.busy && S.tutorial >= 3 && jeepDue() && !World.jeepActive) {
    World.startJeep(); Sound.play('alarm');
    toast('😈 An RSP jeep is in town! Tap it to chase it away!', 'bad');
  }
  if (H.selected && $('#sheet')) { /* keep panel timers fresh */ const t = $('#sheet .mutedtxt'); const b = S.buildings.find(q => q.id === H.selected); if (t && b) t.textContent = `Next ${BUILDINGS[b.type].makes === 'coins' ? 'money' : 'voters'} in ${clock(b.readyAt - Date.now())}`; }
}

// ---------------- buttons ----------------
const ACT = {
  tapstart() { H.started = true; Sound.play('go'); showTitle(); },
  continue() { if (load()) startTown(); },
  newgame() { showSetup(); },
  sym(d) { H.setup.name = $('#f-name').value; H.setup.symbol = SYMBOLS[+d.i]; H.setup.color = COLORS[+d.i]; Sound.play('up'); showSetup(); },
  begin() {
    const name = ($('#f-name').value || '').trim() || 'Asha';
    clearSave(); newState({ leader: name, color: H.setup.color, symbol: H.setup.symbol });
    H.lastBuilt.clear();
    startTown();
    FX.banner(`🏛️ ${esc(name)}'s Party Office`, 'Your journey to Delhi starts here', 'gold', 1800);
  },
  shop() { if (S.tutorial === 0) { S.tutorial = 1; tutorial(); } openShop(); },
  buy(d) { startPlacing(d.t); },
  confirmplace: confirmPlace,
  cancelplace: cancelPlace,
  closesheet() { closeSheet(); H.selected = null; },
  collect(d, el) { collectAt(+d.id, el); },
  select(d) { selectBuilding(+d.id); },
  upgrade(d) { const r = upgrade(+d.id); closeSheet(); if (r.err) return toast(r.err, 'bad'); Sound.play('stamp'); World.sync(S); H.lastBuilt.set(+d.id, false); toast('⬆️ Upgrading…', 'good'); renderHUD(); },
  rush(d) { const r = rush(+d.id); closeSheet(); if (r.err) return toast(r.err, 'bad'); Sound.play('coin'); tick(); },
  sell(d) { const r = sell(+d.id); closeSheet(); if (r.err) return toast(r.err, 'bad'); World.sync(S); renderHUD(); },
  election() { closeSheet(); startElection(); },
  rankinfo() {
    sheet(`<div class="sheet-h"><b>🛤️ Road to Delhi</b><button class="x" data-a="closesheet">✕</button></div>
      <div class="ranks">${RANKS.map((r, i) => `<div class="rk ${i < S.rank ? 'done' : i === S.rank ? 'now' : ''}"><span>${i < S.rank ? '✅' : i === S.rank ? '📍' : '🔒'}</span><b>${r.title}</b>${i === S.rank ? `<small>Next: ${r.next} · need 🗳️ ${fmt(r.votes)}</small>` : ''}</div>`).join('')}</div>`);
  },
  mute(d, el) { const m = Sound.toggleMute(); el.textContent = m ? '🔇' : '🔊'; },
  menu() {
    sheet(`<div class="sheet-h"><b>Menu</b><button class="x" data-a="closesheet">✕</button></div>
      <label class="vol" for="vol-sfx">🎵 Game sounds<input id="vol-sfx" type="range" min="0" max="100" value="${Math.round(Sound.settings.sfx * 100)}"></label>
      <label class="vol" for="vol-music">🎶 Music<input id="vol-music" type="range" min="0" max="100" value="${Math.round(Sound.settings.music * 100)}"></label>
      <button class="gbtn orange" data-a="quit">🏠 Save & exit</button>`);
  },
  quit() { closeSheet(); save(); $('#hud').hidden = true; for (const el of H.bubbles.values()) el.remove(); H.bubbles.clear(); showTitle(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  Sound.unlock();
  if (H.busy && !el.closest('.battle')) return;
  const a = el.dataset.a;
  if (!['collect', 'mute'].includes(a)) Sound.play('tap');
  if (ACT[a]) ACT[a](el.dataset, el);
});
document.addEventListener('input', e => {
  if (e.target.id === 'vol-sfx') { Sound.set('sfx', e.target.value / 100); Sound.play('tap'); }
  if (e.target.id === 'vol-music') Sound.set('music', e.target.value / 100);
});
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

// ---------------- boot ----------------
function boot() {
  World.init($('#world'));
  World.onTapTile(tapTile);
  World.onTapBuilding(id => { if (H.mode === 'town' && !H.busy) selectBuilding(id); });
  World.onTapJeep(escaped => jeepTapped(escaped));
  World.onFrame(placeBubbles);
  // a demo town spins behind the title screen
  if (!load()) { newState({ leader: 'Asha', color: COLORS[0], symbol: SYMBOLS[0] }); clearSave(); }
  World.sync(S);
  setInterval(tick, 250);
  showTitle();
}
boot();
