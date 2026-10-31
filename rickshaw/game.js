// RICKSHAW RUSH — a 3D endless runner through busy Indian streets.
// Swipe left/right to change lanes, swipe up to jump. Arrow keys work too.

(() => {
  const $ = s => document.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SAVE = 'rickshawrush.save.v1';
  const LANES = [-1.7, 0, 1.7];
  const SKINS = [
    { id: 'classic', name: 'Classic', body: '#1f9d55', top: '#ffd400', cost: 0 },
    { id: 'mumbai', name: 'Mumbai', body: '#1d1d1d', top: '#ffd400', cost: 150 },
    { id: 'pink', name: 'Pink Power', body: '#ff4f9a', top: '#ffffff', cost: 300 },
    { id: 'blue', name: 'Electric', body: '#2b7bff', top: '#9ff0ff', cost: 500 },
    { id: 'gold', name: 'Royal Gold', body: '#b8860b', top: '#ffe066', cost: 1000 },
  ];

  const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { return {}; } })();
  save.best = save.best || 0; save.coins = save.coins || 0; save.owned = save.owned || ['classic']; save.skin = save.skin || 'classic';
  const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* storage unavailable */ } };
  const skin = () => SKINS.find(s => s.id === save.skin) || SKINS[0];

  // ---------- three.js setup ----------
  THREE.ColorManagement.legacyMode = false; // treat colours as sRGB, light in linear space
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  let quality = 2; // lowered automatically on slower phones
  renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('#world').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const HAZE = '#eadfca', SKY_TOP = '#5fa8e6';
  scene.fog = new THREE.Fog(HAZE, 30, 100);
  scene.background = new THREE.Color(HAZE);
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 260);

  // sky dome: deep blue overhead fading to a warm, dusty horizon
  function skyDome(radius) {
    const geo = new THREE.SphereGeometry(radius, 32, 16), p = geo.attributes.position, col = [];
    const top = new THREE.Color(SKY_TOP), mid = new THREE.Color('#a9d2f0'), hor = new THREE.Color(HAZE), gnd = new THREE.Color('#b9a888'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / radius;
      if (y > .25) c.copy(mid).lerp(top, (y - .25) / .75); else if (y > 0) c.copy(hor).lerp(mid, y / .25); else c.copy(hor).lerp(gnd, Math.min(1, -y * 4));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  }
  const sky = skyDome(200); scene.add(sky);
  // image-based light from the same sky, so metal, glass and paint reflect it
  {
    const envScene = new THREE.Scene(); envScene.add(skyDome(10));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(.8, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4d6' }));
    sunBall.position.set(-5, 7, 3); envScene.add(sunBall);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, .02).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight('#dceeff', '#9c8a6a', .55));
  const sun = new THREE.DirectionalLight('#ffe9c8', 1.7);
  sun.position.set(-9, 16, 4); sun.target.position.set(0, 0, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 26, bottom: -18, near: 1, far: 60 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);

  function resize() {
    const w = $('#app').clientWidth, h = $('#app').clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- obstacles ----------
  // h: height you must clear by jumping (Infinity = cannot jump), len: length along the road
  const OBSTACLES = {
    cow: { h: Infinity, len: 2.0, make: RM.cow },
    bus: { h: Infinity, len: 4.6, make: RM.bus },
    cart: { h: .75, len: 1.3, make: RM.cart },
    barrier: { h: .8, len: .4, make: RM.barrier },
    pothole: { h: .3, len: 1.3, make: RM.pothole },
  };

  // ---------- pickups ----------
  const POWERS = {
    magnet: { color: '#e53935', label: '🧲 Magnet', secs: 8 },
    nitro: { color: '#29b6f6', label: '⚡ Nitro', secs: 5 },
    double: { color: '#43a047', label: '✖️2 Coins', secs: 10 },
    passenger: { color: '#ec407a', label: '🙋 Passenger', secs: 0 },
  };

  // ---------- the street ----------
  // Everything scrolls towards the camera and jumps back by its loop length.
  const SEG = 20, SEGS = 6, SPAN = SEG * SEGS;
  const scrollers = []; // { g, loop, back }
  const addScroll = (g, loop, back = 14) => { scene.add(g); scrollers.push({ g, loop, back }); return g; };

  const roadMat = new THREE.MeshStandardMaterial({ map: RT.asphalt(), roughness: .92 });
  roadMat.map.wrapT = THREE.RepeatWrapping; roadMat.map.repeat.set(1, 4);
  const paveTex = RT.paving(); paveTex.repeat.set(.7, 8);
  const paveMat = new THREE.MeshStandardMaterial({ map: paveTex, roughness: .95 });
  const dustMat = new THREE.MeshStandardMaterial({ map: RT.dust(), roughness: 1 });
  const kerbY = RM.M('#f2c230', { roughness: .7 }), kerbB = RM.M('#202022', { roughness: .7 });
  const gutter = RM.M('#3d3a36', { roughness: 1 });
  function segment() {
    const g = new THREE.Group();
    const plane = (w, l, m, x, y) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, 0); g.add(p); };
    plane(6.2, SEG, roadMat, 0, 0);
    for (const s of [-1, 1]) {
      plane(1.6, SEG, paveMat, s * 3.95, .2);
      plane(.25, SEG, gutter, s * 3.2, .005);
      for (let z = -SEG / 2; z < SEG / 2; z += 1) {
        const k = new THREE.Mesh(RM.rbox(.16, .22, .98, .03), (z + SEG / 2) % 2 ? kerbB : kerbY);
        k.position.set(s * 3.17, .1, z + .5); g.add(k);
      }
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.6, .2, SEG), RM.M('#8f877c', { roughness: 1 }));
      edge.position.set(s * 3.95, .1, 0); g.add(edge);
    }
    plane(70, SEG, dustMat, 0, -.02);
    return RM.bake(g, { cast: false });
  }
  for (let i = 0; i < SEGS; i++) { const s = segment(); s.position.z = -i * SEG + SEG / 2; addScroll(s, SPAN, SEG * 1.5); }

  // A continuous row of shops on each side, with the odd tree, palm or shrine in a gap.
  for (const side of [-1, 1]) {
    let z = 14; const row = [];
    while (z > -SPAN - 10) {
      const r = Math.random();
      let g, len;
      if (r < .1) { g = RM.shrine(); len = 3.2; g.position.set(side * 6.3, 0, z - len / 2); g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; }
      else if (r < .2) { g = RM.palm(); len = 2.2; g.position.set(side * 5.6, 0, z - len / 2); }
      else {
        g = RM.building(); len = g.userData.w + rnd(0, .15);
        g.position.set(side * (4.75 + g.userData.d / 2), 0, z - len / 2);
        g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      row.push(g); z -= len;
    }
    const loop = 14 - z;
    row.forEach(g => addScroll(g, loop, 18));
  }
  // kerbside: trees, street lamps (right), electric poles with wires (left), parked scooters
  for (let i = 0; i < 10; i++) {
    const z = 8 - i * 12;
    const p = RM.pole(12); p.position.set(-3.45, 0, z); addScroll(p, SPAN, 20);
    if (i % 2 === 0) { const l = RM.lamp(); l.position.set(3.45, 0, z - 6); l.rotation.y = Math.PI; addScroll(l, SPAN); }
    const t = RM.tree(); t.position.set((i % 2 ? -1 : 1) * 3.6, .2, z - 3 - rnd(0, 3)); addScroll(t, SPAN, 18);
    if (Math.random() < .55) { const sc = RM.scooter(); sc.position.set((Math.random() < .5 ? -1 : 1) * 4.0, .2, z - 8); sc.rotation.y = rnd(-.4, .4) + Math.PI / 2; addScroll(sc, SPAN); }
  }
  for (let i = 0; i < 3; i++) { const b = RM.bunting(); b.position.z = -10 - i * 40; addScroll(b, SPAN, 10); }
  { const t = RM.tower(); t.position.set(-15, 0, -70); addScroll(t, SPAN + 40, 30); }
  const clouds = [];
  for (let i = 0; i < 6; i++) { const c = RM.cloud(); c.position.set(rnd(-60, 60), rnd(28, 42), -60 - i * 30); scene.add(c); clouds.push(c); }

  // people walking on the footpaths, or standing and chatting
  const people = [];
  for (let i = 0; i < 16; i++) {
    const p = RM.person(), side = i % 2 ? 1 : -1, walk = Math.random() < .7;
    const dir = Math.random() < .5 ? 1 : -1;
    p.position.set(side * rnd(3.7, 4.4), .2, 10 - i * (SPAN / 16) - rnd(0, 4));
    p.rotation.y = walk ? (dir > 0 ? Math.PI : 0) : side < 0 ? Math.PI / 2 : -Math.PI / 2;
    p.scale.setScalar(rnd(.92, 1.06));
    scene.add(p); people.push({ g: p, speed: walk ? rnd(.9, 1.4) * dir : 0 });
  }

  // ---------- game state ----------
  const G = { state: 'menu', speed: 0, dist: 0, coins: 0, lane: 1, x: 0, y: 0, vy: 0, objs: [], nextSpawn: 30, power: {}, crashT: 0, tilt: 0 };
  let player = RM.rickshaw(skin());
  scene.add(player); scene.add(player.userData.shadow);

  function setSkin() { scene.remove(player); scene.remove(player.userData.shadow); player = RM.rickshaw(skin()); scene.add(player); scene.add(player.userData.shadow); }

  function reset() {
    for (const o of G.objs) scene.remove(o.g);
    Object.assign(G, { speed: 14, dist: 0, coins: 0, lane: 1, x: 0, y: 0, vy: 0, objs: [], nextSpawn: 26, power: {}, crashT: 0, tilt: 0 });
    player.rotation.set(0, 0, 0); player.position.set(0, 0, 0);
  }

  // Spawn a row of obstacles, always leaving at least one lane open, with coins in the open lanes.
  function spawnRow(z) {
    const level = Math.min(1, G.dist / 2500);
    const types = ['cow', 'cart', 'barrier', 'pothole', 'bus'];
    const blocked = [];
    const nBlock = Math.random() < .25 + level * .45 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => Math.random() - .5);
    for (let i = 0; i < nBlock; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const o = OBSTACLES[t], g = o.make();
      const ln = lanes[i];
      g.position.set(LANES[ln], 0, z - (t === 'bus' ? 1.6 : 0));
      scene.add(g);
      G.objs.push({ kind: 'obs', type: t, lane: ln, z: g.position.z, len: o.len, h: o.h, g });
      blocked.push(ln);
    }
    // coins: a line in an open lane, sometimes an arc over a jumpable obstacle
    const open = [0, 1, 2].filter(l => !blocked.includes(l));
    const cl = open[Math.floor(Math.random() * open.length)];
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const c = RM.coin();
      const cz = z + 6 - i * 1.6;
      c.position.set(LANES[cl], .7, cz);
      scene.add(c);
      G.objs.push({ kind: 'coin', lane: cl, z: cz, g: c });
    }
    if (Math.random() < .12) {
      const types2 = Object.keys(POWERS), pt = types2[Math.floor(Math.random() * types2.length)];
      const pl = open[(open.indexOf(cl) + 1) % open.length], g = RM.power(pt, POWERS[pt].color);
      g.position.set(LANES[pl], 0, z - 4); scene.add(g);
      G.objs.push({ kind: 'power', type: pt, lane: pl, z: z - 4, g });
    }
  }

  // ---------- controls ----------
  function move(dir) {
    if (G.state !== 'run') return;
    const nl = Math.max(0, Math.min(2, G.lane + dir));
    if (nl !== G.lane) { G.lane = nl; G.tilt = -dir * .35; Sound.play('swipe'); buzz(8); }
  }
  function jump() {
    if (G.state !== 'run' || G.y > .05) return;
    G.vy = 9.5; Sound.play('whoosh'); buzz(10);
  }
  let sx = 0, sy = 0, st = 0, swiped = false;
  const view = $('#world');
  view.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = performance.now(); swiped = false; Sound.unlock(); });
  view.addEventListener('pointermove', e => {
    if (swiped || !e.buttons && e.pointerType === 'mouse') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) { move(dx > 0 ? 1 : -1); swiped = true; }
    else if (dy < -30 && Math.abs(dy) > Math.abs(dx)) { jump(); swiped = true; }
  });
  view.addEventListener('pointerup', e => {
    if (swiped || performance.now() - st > 300) return;
    // a quick tap on the left or right side also changes lane
    const w = view.clientWidth;
    if (e.clientX < w * .33) move(-1); else if (e.clientX > w * .67) move(1); else jump();
  });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') move(-1);
    if (e.key === 'ArrowRight' || e.key === 'd') move(1);
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') jump();
  });

  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } };

  // ---------- HUD ----------
  const hud = $('#hud');
  function showHud() {
    hud.innerHTML = `<div class="top"><div class="score"><small>SCORE</small><b id="score">0</b></div><div class="coins">🪙 <b id="coins">0</b></div>
      <button class="iconb" data-a="pause" aria-label="Pause">⏸</button></div>
      <div id="powers" class="powers"></div>
      <button class="horn" data-a="horn" aria-label="Horn">📯</button>`;
  }
  function updateHud() {
    const s = $('#score'), c = $('#coins');
    if (s) s.textContent = Math.floor(G.dist);
    if (c) c.textContent = G.coins;
    const p = $('#powers');
    if (p) p.innerHTML = Object.entries(G.power).filter(([, t]) => t > 0).map(([k, t]) => `<span class="pw">${POWERS[k].label} <i style="width:${Math.min(100, t / POWERS[k].secs * 100)}%"></i></span>`).join('');
  }

  function showMenu() {
    G.state = 'menu';
    Sound.music('title');
    hud.innerHTML = '';
    $('#screen').innerHTML = `<div class="menu">
      ${ready ? '' : '<button class="tap" data-a="tap"><span>🛺</span><b>TAP TO START</b><small>🔊 Sound on</small></button>'}
      <h1 class="logo"><span>RICKSHAW</span><span class="r2">RUSH</span></h1>
      <p class="tag">Dodge the traffic. Grab the coins. Rule the road!</p>
      <div class="stats"><div><small>BEST</small><b>${save.best}</b></div><div><small>COINS</small><b>🪙 ${save.coins}</b></div></div>
      <div class="spacer"></div>
      <button class="btn green big glow" data-a="play">▶ PLAY</button>
      <button class="btn blue" data-a="garage">🛺 Garage</button>
      <p class="howto">⬅️ ➡️ Swipe to change lane · ⬆️ Swipe up to jump</p>
      <button class="iconb corner" data-a="sound" aria-label="Sound settings">${Sound.settings.muted ? '🔇' : '🔊'}</button>
    </div>`;
  }

  function showGarage() {
    $('#screen').innerHTML = `<div class="menu garage">
      <h2>🛺 Garage</h2><p class="tag">🪙 ${save.coins} coins</p>
      <div class="skins">${SKINS.map(s => {
        const own = save.owned.includes(s.id), on = save.skin === s.id;
        return `<button class="skin ${on ? 'on' : ''}" data-a="skin" data-id="${s.id}">
          <span class="sw" style="background:linear-gradient(180deg, ${s.top} 0 45%, ${s.body} 45%)"></span>
          <b>${s.name}</b><small>${on ? '✅ Driving' : own ? 'Tap to drive' : `🪙 ${s.cost}`}</small></button>`;
      }).join('')}</div>
      <div class="spacer"></div>
      <button class="btn green big" data-a="menu">◀ BACK</button></div>`;
  }

  function start() {
    $('#screen').innerHTML = '';
    reset();
    showHud();
    G.state = 'count';
    Sound.music('run');
    let n = 3;
    const cd = document.createElement('div'); cd.className = 'count'; $('#app').appendChild(cd);
    const step = () => {
      cd.textContent = n ? n : 'GO!';
      cd.classList.remove('beat'); void cd.offsetWidth; cd.classList.add('beat');
      Sound.play(n ? 'count' : 'go');
      if (n-- > 0) setTimeout(step, 600); else setTimeout(() => { cd.remove(); G.state = 'run'; }, 500);
    };
    step();
  }

  function crash() {
    G.state = 'crash'; G.crashT = 0;
    Sound.play('stamp'); Sound.play('bad'); buzz([60, 40, 120]);
    $('#app').classList.add('shake'); setTimeout(() => $('#app').classList.remove('shake'), 500);
    const score = Math.floor(G.dist) + G.coins * 5;
    const isBest = score > save.best;
    save.coins += G.coins; if (isBest) save.best = score; persist();
    setTimeout(() => {
      G.state = 'over';
      Sound.music('title');
      if (isBest) { Sound.play('win'); FX.confetti(140); }
      hud.innerHTML = '';
      $('#screen').innerHTML = `<div class="menu over">
        <h2>${isBest ? '🏆 NEW BEST!' : '💥 CRASH!'}</h2>
        <div class="card"><div><small>DISTANCE</small><b>${Math.floor(G.dist)} m</b></div><div><small>COINS</small><b>🪙 ${G.coins} × 5</b></div><div class="total"><small>SCORE</small><b>${score}</b></div></div>
        <p class="tag">Best: ${save.best} · Wallet: 🪙 ${save.coins}</p>
        <div class="spacer"></div>
        <button class="btn green big glow" data-a="play">↻ PLAY AGAIN</button>
        <button class="btn blue" data-a="garage">🛺 Garage</button>
        <button class="btn ghost" data-a="menu">Home</button></div>`;
    }, 1100);
  }

  let ready = false, paused = false;
  const volumeHtml = () => `<div class="vol">
      <label>🎵 Music <input type="range" min="0" max="100" value="${Math.round(Sound.settings.music * 100)}" data-vol="music"></label>
      <label>🔔 Effects <input type="range" min="0" max="100" value="${Math.round(Sound.settings.sfx * 100)}" data-vol="sfx"></label>
      <button class="btn ghost" data-a="mute">${Sound.settings.muted ? '🔇 Sound off' : '🔊 Sound on'}</button></div>`;
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.vol;
    if (k) { Sound.unlock(); Sound.set(k, e.target.value / 100); if (k === 'sfx') Sound.play('coin'); }
  });
  const ACT = {
    tap() { ready = true; Sound.unlock(); Sound.play('go'); showMenu(); },
    play() { Sound.unlock(); start(); },
    garage: showGarage,
    menu: showMenu,
    skin(d) {
      const s = SKINS.find(x => x.id === d.id);
      if (!save.owned.includes(s.id)) {
        if (save.coins < s.cost) { Sound.play('oops'); return; }
        save.coins -= s.cost; save.owned.push(s.id); Sound.play('coin'); FX.confetti(80);
      }
      save.skin = s.id; persist(); setSkin(); Sound.play('good'); showGarage();
    },
    pause() {
      paused = !paused;
      if (paused) { const p = document.createElement('div'); p.className = 'pausebox'; p.innerHTML = `<b>⏸ Paused</b>${volumeHtml()}<button class="btn green big" data-a="pause">▶ Resume</button><button class="btn ghost" data-a="quit">Quit</button>`; $('#app').appendChild(p); }
      else { const p = $('.pausebox'); if (p) p.remove(); }
    },
    quit() { paused = false; const p = $('.pausebox'); if (p) p.remove(); G.state = 'menu'; for (const o of G.objs) scene.remove(o.g); G.objs = []; showMenu(); },
    horn() { Sound.play('bus'); },
    sound() {
      if ($('.volbox')) { $('.volbox').remove(); return; }
      const b = document.createElement('div'); b.className = 'pausebox volbox';
      b.innerHTML = `<b>🔊 Sound</b>${volumeHtml()}<button class="btn green big" data-a="sound">✓ Done</button>`;
      $('#app').appendChild(b);
    },
    mute() { Sound.toggleMute(); const m = $('[data-a=mute]'); if (m) m.textContent = Sound.settings.muted ? '🔇 Sound off' : '🔊 Sound on'; const c = $('.corner'); if (c) c.textContent = Sound.settings.muted ? '🔇' : '🔊'; },
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    Sound.unlock();
    if (el.dataset.a !== 'horn' && el.dataset.a !== 'tap') Sound.play('tap');
    ACT[el.dataset.a] && ACT[el.dataset.a](el.dataset);
  });

  // ---------- main loop ----------
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    const time = t / 1000;
    const running = G.state === 'run' && !paused;
    let v = 0;
    if (running) {
      G.speed = Math.min(34, 14 + G.dist / 140);
      v = G.speed * (G.power.nitro > 0 ? 1.6 : 1);
      G.dist += v * dt;
      for (const k in G.power) G.power[k] -= dt;
    } else if (G.state === 'menu' || G.state === 'over') v = 6; // cruise behind the menus
    else if (G.state === 'crash') v = Math.max(0, 10 - G.crashT * 20);

    // scroll the street
    for (const s of scrollers) { s.g.position.z += v * dt; if (s.g.position.z > s.back) s.g.position.z -= s.loop; }
    for (const p of people) {
      p.g.position.z += (v - p.speed) * dt;
      if (p.g.position.z > 14) p.g.position.z -= SPAN; else if (p.g.position.z < -SPAN + 14) p.g.position.z += SPAN;
      RM.animatePerson(p.g, time, Math.abs(p.speed));
    }
    for (const c of clouds) { c.position.z += v * dt * .03 + dt * .3; if (c.position.z > 0) c.position.z -= 200; }
    Sound.engine(G.state === 'run' && !paused, G.speed);

    // player: lane change, jump, bounce
    G.x += (LANES[G.lane] - G.x) * Math.min(1, dt * 12);
    G.vy -= 28 * dt; G.y = Math.max(0, G.y + G.vy * dt); if (G.y === 0) G.vy = Math.max(0, G.vy);
    G.tilt *= .9;
    if (G.state !== 'crash' && G.state !== 'over') {
      player.position.set(G.x, G.y + (G.y === 0 ? Math.abs(Math.sin(time * 18)) * .03 * (v > 0) : 0), 0);
      player.rotation.set(G.y > 0 ? -.12 : 0, 0, G.tilt);
    } else if (G.state === 'crash') {
      G.crashT += dt; player.rotation.z += dt * 9; player.position.y = Math.max(0, Math.sin(G.crashT * 4) * 1.2);
    }
    player.userData.shadow.position.set(player.position.x, .02, 0);
    player.userData.shadow.scale.setScalar(Math.max(.5, 1 - G.y * .3));
    for (const w of player.userData.wheels) w.rotation.x -= v * dt * 4;

    if (running) {
      // spawn ahead
      G.nextSpawn -= v * dt;
      if (G.nextSpawn <= 0) { spawnRow(-90); G.nextSpawn = Math.max(11, 20 - G.dist / 300); }
      const magnet = G.power.magnet > 0;
      for (const o of G.objs) {
        o.z += v * dt; o.g.position.z = o.z;
        if (o.kind === 'coin') {
          o.g.rotation.y += dt * 4;
          if (magnet && o.z > -14 && o.z < 1) { o.g.position.x += (G.x - o.g.position.x) * dt * 8; o.g.position.y += (G.y + .7 - o.g.position.y) * dt * 8; }
          const near = Math.abs(o.z) < .9 && Math.abs(o.g.position.x - G.x) < .9 && Math.abs(o.g.position.y - (G.y + .7)) < 1;
          if (near) { o.dead = true; G.coins += G.power.double > 0 ? 2 : 1; Sound.play('pop'); }
        } else if (o.kind === 'power') {
          o.g.rotation.y += dt * 2; o.g.position.y = Math.sin(time * 3) * .1;
          if (Math.abs(o.z) < 1 && o.lane === G.lane) {
            o.dead = true;
            if (o.type === 'passenger') { G.coins += 25; Sound.play('win'); toast('🙋 Passenger! +25 coins'); }
            else { G.power[o.type] = POWERS[o.type].secs; Sound.play('good'); toast(POWERS[o.type].label + '!'); }
            buzz(20);
          }
        } else if (o.kind === 'obs') {
          if (o.g.userData.head) o.g.userData.head.rotation.z = Math.sin(time * 1.6 + o.z) * .12;
          const hit = Math.abs(o.z) < o.len / 2 + .7 && o.lane === G.lane && Math.abs(G.x - LANES[o.lane]) < 1.1 && G.y < o.h;
          if (hit) {
            if (G.power.nitro > 0) { o.dead = true; Sound.play('smash'); toast('⚡ SMASH!'); }
            else { crash(); break; }
          }
        }
        if (o.z > 8) o.dead = true;
      }
      G.objs = G.objs.filter(o => { if (o.dead) scene.remove(o.g); return !o.dead; });
      updateHud();
    }

    // camera follows from behind and above
    camera.position.set(G.x * .6, 3.4 + G.y * .3, 6.2);
    camera.lookAt(G.x * .4, .9, -7);
    camera.fov = 60 + (G.power.nitro > 0 && running ? 10 : 0) + Math.min(8, (G.speed - 14) * .3);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    adaptQuality(dt);
    requestAnimationFrame(loop);
  }

  // If frames are slow, render fewer pixels and softer shadows.
  let slowT = 0, frames = 0;
  function adaptQuality(dt) {
    if (quality === 0 || document.hidden) return;
    frames++;
    slowT = dt > 1 / 40 ? slowT + dt : Math.max(0, slowT - dt * .5);
    if (frames > 90 && slowT > 1.5) {
      quality--; slowT = 0; frames = 0;
      renderer.setPixelRatio(quality === 1 ? Math.min(devicePixelRatio, 1.4) : 1);
      if (quality === 0) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; }
      resize();
    }
  }

  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.className = 'toast show';
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'toast'; }, 1200);
  }

  resize();
  showMenu();
  requestAnimationFrame(loop);
  window.RR = { G, start, crash, spawnRow, renderer, sun, scene }; // handy for testing
})();
