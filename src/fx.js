// RAJNEETI — game "juice": confetti, reward bursts, flying coins, floating
// numbers, screen shake and banners. Every effect returns a promise that
// resolves when it is done, so the game can play them in sequence.

const FX = (() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const app = () => document.getElementById('app');
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- confetti on a canvas over the whole game ----
  let canvas = null, parts = [], running = false;
  function confetti(n = 120, colors = ['#ff9933', '#ffffff', '#138808', '#ffd166', '#7b4dff', '#ff5f8a']) {
    if (calm()) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'fx-canvas';
      app().appendChild(canvas);
    }
    if (!canvas.isConnected) app().appendChild(canvas);
    const w = canvas.width = app().clientWidth * devicePixelRatio, h = canvas.height = app().clientHeight * devicePixelRatio;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: w / 2 + (Math.random() - .5) * w * .3, y: h * .45,
        vx: (Math.random() - .5) * 26 * devicePixelRatio, vy: (-Math.random() * 26 - 8) * devicePixelRatio,
        r: (4 + Math.random() * 6) * devicePixelRatio, c: colors[i % colors.length],
        a: Math.random() * 6, va: (Math.random() - .5) * .4, life: 1,
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += .9 * devicePixelRatio; p.vx *= .985; p.vy *= .985;
      p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= .006;
      g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.translate(p.x, p.y); g.rotate(p.a);
      g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      g.restore();
    }
    parts = parts.filter(p => p.life > 0 && p.y < canvas.height + 40);
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // ---- a big popping reward card in the middle of the screen ----
  async function burst(emoji, title, kind = 'good', sub = '') {
    const el = document.createElement('div');
    el.className = `fx-burst ${kind}`;
    el.innerHTML = `<div class="rays"></div><div class="b-emo">${emoji}</div><div class="b-title">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
    app().appendChild(el);
    if (kind === 'good') confetti(60);
    if (kind === 'bad') shake();
    await wait(calm() ? 900 : 1300);
    el.classList.add('out');
    await wait(250);
    el.remove();
  }

  // ---- a banner that sweeps across ("WEEK 4", "RSP's turn") ----
  async function banner(title, sub = '', cls = '', ms = 1100) {
    const el = document.createElement('div');
    el.className = `fx-banner ${cls}`;
    el.innerHTML = `<div class="ban-in"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    app().appendChild(el);
    Sound.play('whoosh');
    await wait(ms);
    el.classList.add('out');
    await wait(300);
    el.remove();
  }

  function shake() {
    if (calm()) return;
    const a = app();
    a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
    setTimeout(() => a.classList.remove('shake'), 500);
  }

  // ---- "+12" rising from an element ----
  function floatText(target, text, color = '#fff') {
    const r = target.getBoundingClientRect(), base = app().getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'fx-float';
    el.textContent = text; el.style.color = color;
    el.style.left = (r.left - base.left + r.width / 2) + 'px';
    el.style.top = (r.top - base.top) + 'px';
    app().appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---- emoji flying from one element to another (coins to the wallet) ----
  async function fly(emoji, from, to, n = 6) {
    if (!from || !to || calm()) return;
    const base = app().getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'fx-fly'; el.textContent = emoji;
      el.style.left = (a.left - base.left + a.width / 2 + (Math.random() - .5) * 60) + 'px';
      el.style.top = (a.top - base.top + a.height / 2) + 'px';
      app().appendChild(el);
      const dx = (b.left - a.left) + (b.width - a.width) / 2, dy = (b.top - a.top) + (b.height - a.height) / 2;
      setTimeout(() => { el.style.transform = `translate(${dx}px, ${dy}px) scale(.5)`; el.style.opacity = '.2'; }, 30 + i * 70);
      setTimeout(() => { el.remove(); if (i % 2 === 0) Sound.play('tick'); }, 650 + i * 70);
    }
    await wait(650 + n * 70);
  }

  // ---- count a number up or down inside an element ----
  function countUp(el, from, to, ms = 700) {
    if (!el || from === to) return;
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = from;
    requestAnimationFrame(step);
  }

  // floating ballots and kites drifting up behind the title screen
  function sky(holder) {
    if (!holder || calm()) return;
    const icons = ['🪁', '🎈', '✉️', '⭐', '🪁', '🎈'];
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('span');
      el.className = 'sky-item'; el.textContent = icons[i % icons.length];
      el.style.left = (Math.random() * 92) + '%';
      el.style.animationDelay = (-Math.random() * 14) + 's';
      el.style.animationDuration = (10 + Math.random() * 8) + 's';
      el.style.fontSize = (18 + Math.random() * 22) + 'px';
      holder.appendChild(el);
    }
  }

  return { wait, confetti, burst, banner, shake, floatText, fly, countUp, sky };
})();
