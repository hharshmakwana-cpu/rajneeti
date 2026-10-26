// RAJNEETI — quick finger games that decide how well a campaign move goes.
// Each returns a promise with its result once the player has finished.

const Mini = (() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById('app');

  function overlay(cls, html) {
    const el = document.createElement('div');
    el.className = 'mini ' + cls;
    el.innerHTML = html;
    app().appendChild(el);
    return el;
  }

  async function countdown(el) {
    const c = el.querySelector('.mg-count');
    for (const n of ['3', '2', '1', 'GO!']) {
      c.textContent = n; c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat');
      Sound.play(n === 'GO!' ? 'go' : 'count');
      await wait(n === 'GO!' ? 450 : 550);
    }
    c.textContent = '';
  }

  async function finish(el, emoji, title, sub) {
    const box = el.querySelector('.mg-end');
    box.innerHTML = `<div class="b-emo">${emoji}</div><div class="b-title">${title}</div><div class="b-sub">${sub}</div>`;
    box.hidden = false;
    await wait(1300);
    el.classList.add('out');
    await wait(250);
    el.remove();
  }

  const stars = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);

  // ---- RALLY: tap the happy supporters, not the angry ones ----
  async function rally(stateName) {
    const el = overlay('rally', `
      <div class="mg-head"><b>📣 Rally in ${stateName}</b><span>Tap the happy fans 😀 — not the angry ones 😠</span></div>
      <div class="mg-score">Fans: <b>0</b></div>
      <div class="mg-time"><i></i></div>
      <div class="crowd">${'<button class="hole" aria-label="crowd spot"><span></span></button>'.repeat(9)}</div>
      <div class="mg-count"></div><div class="mg-end" hidden></div>`);
    await countdown(el);
    const holes = [...el.querySelectorAll('.hole')], scoreEl = el.querySelector('.mg-score b');
    let score = 0, live = true;
    const show = () => {
      if (!live) return;
      const free = holes.filter(h => !h.dataset.kind);
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        const r = Math.random(), kind = r < .14 ? 'angry' : r < .24 ? 'star' : 'fan';
        h.dataset.kind = kind;
        h.firstChild.textContent = kind === 'angry' ? '😠' : kind === 'star' ? '🤩' : ['😀', '😄', '🙋', '🙌'][Math.floor(Math.random() * 4)];
        h.classList.add('up');
        setTimeout(() => { h.classList.remove('up'); delete h.dataset.kind; }, 950 - Math.min(400, score * 12));
      }
      setTimeout(show, Math.max(260, 520 - score * 10));
    };
    holes.forEach(h => h.addEventListener('pointerdown', e => {
      e.preventDefault();
      const k = h.dataset.kind;
      if (!live || !k) return;
      delete h.dataset.kind; h.classList.remove('up');
      const pts = k === 'angry' ? -2 : k === 'star' ? 3 : 1;
      score = Math.max(0, score + pts);
      scoreEl.textContent = score;
      FX.floatText(h, pts > 0 ? `+${pts}` : `${pts}`, pts > 0 ? '#16a34a' : '#dc2626');
      Sound.play(pts > 0 ? 'pop' : 'oops'); navigator.vibrate && navigator.vibrate(pts > 0 ? 8 : 40);
      h.classList.add(pts > 0 ? 'hit' : 'miss'); setTimeout(() => h.classList.remove('hit', 'miss'), 250);
    }));
    el.querySelector('.mg-time i').style.animationDuration = '7s';
    el.classList.add('running');
    show(); show();
    await wait(7000);
    live = false;
    const power = clamp(.5 + score * .07, .5, 1.9);
    const s = score >= 16 ? 3 : score >= 9 ? 2 : 1;
    Sound.play(s >= 2 ? 'cheer' : 'oops');
    await finish(el, s === 3 ? '🤩' : s === 2 ? '😀' : '🙂', `${score} fans! ${stars(s)}`, s === 3 ? 'Huge rally!' : s === 2 ? 'Good rally!' : 'Small crowd');
    return power;
  }

  // ---- MAKE FRIENDS: stop the swinging needle in the green zone ----
  async function handshake(partyShort, chance) {
    const zone = clamp(.12 + chance * .5, .12, .5), start = .5 - zone / 2 + (Math.random() - .5) * (1 - zone) * .6;
    const el = overlay('shake', `
      <div class="mg-head"><b>🤝 Make friends with ${partyShort}</b><span>Tap when the hand is in the <b class="g">green</b>!</span></div>
      <div class="hands">🫱 <span class="pulse-heart">💚</span> 🫲</div>
      <div class="meterbar"><i class="zone" style="left:${start * 100}%;width:${zone * 100}%"></i><span class="needle">✋</span></div>
      <button class="gbtn green big tapbtn">TAP! 🤝</button>
      <div class="mg-count"></div><div class="mg-end" hidden></div>`);
    await countdown(el);
    const needle = el.querySelector('.needle');
    let pos = 0, dir = 1, live = true;
    const speed = .9 + Math.random() * .3; // full sweeps per second
    let last = performance.now();
    const loop = t => {
      if (!live) return;
      pos += dir * speed * (t - last) / 1000; last = t;
      if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      needle.style.left = (pos * 100) + '%';
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const hit = await new Promise(res => {
      const btn = el.querySelector('.tapbtn');
      const go = e => { e.preventDefault(); live = false; res(pos >= start && pos <= start + zone); };
      btn.addEventListener('pointerdown', go, { once: true });
      el.querySelector('.meterbar').addEventListener('pointerdown', go, { once: true });
      setTimeout(() => { if (live) { live = false; res(false); } }, 6000);
    });
    needle.classList.add(hit ? 'hit' : 'miss');
    Sound.play(hit ? 'good' : 'oops');
    await wait(600);
    el.classList.add('out');
    await wait(250);
    el.remove();
    return hit;
  }

  // ---- COLLECT MONEY: catch the coins, dodge the stones ----
  async function coins() {
    const el = overlay('coins', `
      <div class="mg-head"><b>💰 Collect money</b><span>Move the bag. Catch 🪙 and 💰 — not 🪨!</span></div>
      <div class="mg-score">Money: <b>0</b></div>
      <div class="mg-time"><i></i></div>
      <div class="field"><span class="bag">👜</span></div>
      <div class="mg-count"></div><div class="mg-end" hidden></div>`);
    await countdown(el);
    const field = el.querySelector('.field'), bag = el.querySelector('.bag'), scoreEl = el.querySelector('.mg-score b');
    let bagX = .5, score = 0, live = true;
    const items = [];
    const moveTo = e => { const r = field.getBoundingClientRect(); bagX = clamp((e.clientX - r.left) / r.width, .06, .94); };
    field.addEventListener('pointerdown', e => { field.setPointerCapture(e.pointerId); moveTo(e); });
    field.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') moveTo(e); });
    let last = performance.now(), spawn = 0;
    const loop = t => {
      if (!live) return;
      const dt = Math.min(50, t - last) / 1000; last = t; spawn -= dt;
      if (spawn <= 0) {
        spawn = .38;
        const r = Math.random(), kind = r < .18 ? 'rock' : r < .3 ? 'bag' : 'coin';
        const it = document.createElement('span');
        it.className = 'drop'; it.textContent = kind === 'rock' ? '🪨' : kind === 'bag' ? '💰' : '🪙';
        field.appendChild(it);
        items.push({ el: it, x: .08 + Math.random() * .84, y: -.05, v: .45 + Math.random() * .3, kind });
      }
      for (const it of items) {
        it.y += it.v * dt;
        it.el.style.left = (it.x * 100) + '%'; it.el.style.top = (it.y * 100) + '%';
        if (!it.done && it.y > .82 && it.y < .95 && Math.abs(it.x - bagX) < .11) {
          it.done = true; it.el.remove();
          const pts = it.kind === 'rock' ? -3 : it.kind === 'bag' ? 3 : 1;
          score = Math.max(0, score + pts); scoreEl.textContent = score * 5;
          Sound.play(pts > 0 ? 'coin' : 'oops'); navigator.vibrate && navigator.vibrate(pts > 0 ? 6 : 40);
          bag.classList.remove('gulp'); void bag.offsetWidth; bag.classList.add('gulp');
        }
        if (it.y > 1.05 && !it.done) { it.done = true; it.el.remove(); }
      }
      bag.style.left = (bagX * 100) + '%';
      requestAnimationFrame(loop);
    };
    el.querySelector('.mg-time i').style.animationDuration = '7s';
    el.classList.add('running');
    requestAnimationFrame(loop);
    await wait(7000);
    live = false;
    const mult = clamp(.4 + score * .09, .4, 2.4);
    const s = score >= 16 ? 3 : score >= 9 ? 2 : 1;
    Sound.play('coin');
    await finish(el, '💰', `+${Math.round(50 * mult)} money! ${stars(s)}`, s === 3 ? 'Rich campaign!' : s === 2 ? 'Nice!' : 'A little money');
    return mult;
  }

  // ---- FIX INDIA: tap problems on the map before they blow up ----
  const PROBLEMS = [
    { icon: '🔥', bloc: 'poor' }, { icon: '🌊', bloc: 'poor' }, { icon: '🤒', bloc: 'poor' },
    { icon: '🧅', bloc: 'middle' }, { icon: '🚧', bloc: 'middle' }, { icon: '✊', bloc: 'workers' },
    { icon: '🌾', bloc: 'farmers' }, { icon: '🎓', bloc: 'youth' }, { icon: '🏭', bloc: 'business' },
  ];
  async function fixIndia(level = 1) {
    const el = overlay('fix', `
      <div class="mg-head"><b>🇮🇳 Fix India!</b><span>Tap problems before they blow up 💥 · ⭐ gives energy</span></div>
      <div class="mg-score">Fixed: <b>0</b> · Missed: <i>0</i></div>
      <div class="mg-time"><i></i></div>
      <div class="fixmap">${STATES.map(st => `<button class="ft" data-s="${st.id}" style="grid-column:${st.pos[0] + 1};grid-row:${st.pos[1] + 1}"><small>${st.id}</small><span></span></button>`).join('')}</div>
      <div class="mg-count"></div><div class="mg-end" hidden></div>`);
    await countdown(el);
    const tiles = [...el.querySelectorAll('.ft')], fixedEl = el.querySelector('.mg-score b'), missEl = el.querySelector('.mg-score i');
    const res = { fixed: 0, missed: 0, stars: 0, byBloc: {} };
    const tally = (b, k) => { res.byBloc[b] = res.byBloc[b] || { fixed: 0, missed: 0 }; res.byBloc[b][k]++; };
    let live = true;
    const life = Math.max(1800, 2900 - level * 120);
    const spawn = () => {
      if (!live) return;
      const free = tiles.filter(t => !t.dataset.p);
      if (free.length) {
        const t = free[Math.floor(Math.random() * free.length)];
        const star = Math.random() < .1, pr = star ? null : PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
        t.dataset.p = star ? 'star' : pr.bloc;
        t.querySelector('span').textContent = star ? '⭐' : pr.icon;
        t.classList.remove('boom', 'ok'); t.classList.add('on');
        t.style.setProperty('--life', life + 'ms');
        t._timer = setTimeout(() => {
          if (!t.dataset.p) return;
          const b = t.dataset.p;
          delete t.dataset.p; t.classList.remove('on');
          if (b !== 'star') { res.missed++; tally(b, 'missed'); missEl.textContent = res.missed; t.classList.add('boom'); Sound.play('oops'); }
          t.querySelector('span').textContent = b === 'star' ? '' : '💥';
          setTimeout(() => { if (!t.dataset.p) { t.querySelector('span').textContent = ''; t.classList.remove('boom'); } }, 500);
        }, life);
      }
      setTimeout(spawn, Math.max(330, 700 - level * 30 - res.fixed * 6));
    };
    tiles.forEach(t => t.addEventListener('pointerdown', e => {
      e.preventDefault();
      const b = t.dataset.p;
      if (!live || !b) return;
      clearTimeout(t._timer);
      delete t.dataset.p; t.classList.remove('on'); t.classList.add('ok');
      if (b === 'star') { res.stars++; FX.floatText(t, '+⭐', '#ffd166'); Sound.play('coin'); }
      else { res.fixed++; tally(b, 'fixed'); fixedEl.textContent = res.fixed; FX.floatText(t, '✅', '#16a34a'); Sound.play('pop'); }
      navigator.vibrate && navigator.vibrate(8);
      t.querySelector('span').textContent = '✨';
      setTimeout(() => { if (!t.dataset.p) { t.querySelector('span').textContent = ''; t.classList.remove('ok'); } }, 350);
    }));
    el.querySelector('.mg-time i').style.animationDuration = '15s';
    el.classList.add('running');
    spawn(); setTimeout(spawn, 250);
    await wait(15000);
    live = false;
    tiles.forEach(t => clearTimeout(t._timer));
    const total = res.fixed + res.missed, pct = total ? res.fixed / total : 1;
    const s = pct >= .85 ? 3 : pct >= .6 ? 2 : 1;
    Sound.play(s >= 2 ? 'good' : 'bad');
    await finish(el, s === 3 ? '🦸' : s === 2 ? '😀' : '😓', `Fixed ${res.fixed} of ${total}! ${stars(s)}`, s === 3 ? 'Super PM!' : s === 2 ? 'Good work!' : 'India needs you faster!');
    return res;
  }

  return { rally, handshake, coins, fixIndia };
})();
