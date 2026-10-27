// RICKSHAW RUSH — a 3D endless runner through busy Indian streets.
// Swipe left/right to change lanes, swipe up to jump. Arrow keys work too.

(() => {
  const $ = s => document.querySelector(s);
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
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  $('#world').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const SKY = '#9fdcff';
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 35, 95);
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 200);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a5a', .8));
  const sun = new THREE.DirectionalLight('#fff1d0', .8); sun.position.set(-6, 12, 4); scene.add(sun);

  function resize() {
    const w = $('#app').clientWidth, h = $('#app').clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- low-poly building blocks ----------
  const mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mats.get(c); };
  const mesh = (geo, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); return m; };
  const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
  const cyl = (r1, r2, h, c, x, y, z, seg = 8) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), c, x, y + h / 2, z);
  const ball = (r, c, x, y, z) => mesh(new THREE.IcosahedronGeometry(r, 0), c, x, y, z);
  const wheel = (r, x, y, z) => { const w = mesh(new THREE.CylinderGeometry(r, r, .14, 10), '#222', x, y, z); w.rotation.z = Math.PI / 2; return w; };

  function rickshawModel(s) {
    const g = new THREE.Group();
    g.add(box(1.05, .32, 1.7, s.body, 0, .22, 0));                 // floor pan
    g.add(box(.6, .5, .55, s.body, 0, .3, -.85));                  // nose
    g.add(box(.62, .06, .56, s.top, 0, .8, -.85));
    g.add(box(1.0, .55, .7, s.body, 0, .5, .45));                  // passenger seat box
    g.add(box(.9, .15, .6, '#7a1f1f', 0, .65, .25));               // seat
    for (const [x, z] of [[-.5, -.55], [.5, -.55], [-.5, .75], [.5, .75]]) g.add(cyl(.03, .03, .9, '#333', x, .55, z, 6));
    g.add(box(1.12, .1, 1.55, s.top, 0, 1.42, .1));                // canopy roof
    g.add(box(1.12, .25, .08, s.top, 0, 1.2, .85));                // back flap
    const glass = box(.7, .45, .04, '#9fd6ff', 0, .78, -.62); glass.material = new THREE.MeshLambertMaterial({ color: '#bfe6ff', transparent: true, opacity: .7 }); g.add(glass);
    g.add(ball(.09, '#fffbe0', 0, .55, -1.14));                    // headlight
    g.add(ball(.13, '#c68a5c', 0, 1.0, -.25));                     // driver's head
    g.add(box(.3, .32, .2, '#ffffff', 0, .62, -.25));              // driver's shirt
    g.add(box(.28, .05, .3, '#2b2b2b', 0, 1.1, -.25));             // cap
    g.add(wheel(.2, 0, .2, -1.0));
    g.add(wheel(.22, -.55, .22, .55)); g.add(wheel(.22, .55, .22, .55));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.95, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .25 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; shadow.scale.z = 1.3;
    g.userData.shadow = shadow;
    return g;
  }

  // ---------- obstacles ----------
  // h: height you must clear by jumping (Infinity = cannot jump), len: length along the road
  const OBSTACLES = {
    cow: { h: Infinity, len: 1.4, make() {
      const g = new THREE.Group(), c = Math.random() < .5 ? '#f4efe6' : '#8a6a4a';
      g.add(box(1.5, .6, .7, c, 0, .6, 0)); g.add(box(.35, .2, .3, c, -.45, 1.15, 0)); // body and hump
      for (const [x, z] of [[-.55, -.25], [.55, -.25], [-.55, .25], [.55, .25]]) g.add(cyl(.07, .06, .6, c, x, 0, z, 5));
      g.add(box(.4, .38, .36, c, .9, .85, 0));                        // head
      g.add(mesh(new THREE.ConeGeometry(.05, .25, 4), '#e8d9b0', .95, 1.32, .14)); g.add(mesh(new THREE.ConeGeometry(.05, .25, 4), '#e8d9b0', .95, 1.32, -.14));
      g.add(box(.05, .4, .05, '#555', -.78, .55, 0));                 // tail
      g.rotation.y = Math.random() < .5 ? 0 : Math.PI;
      return g;
    } },
    bus: { h: Infinity, len: 4.4, make() {
      const g = new THREE.Group(), c = ['#d63a2f', '#2f7bd6', '#e8a317'][Math.floor(Math.random() * 3)];
      g.add(box(1.5, 1.7, 4.4, c, 0, .35, 0));
      g.add(box(1.52, .45, 3.8, '#2b4560', 0, 1.2, .2));             // windows
      g.add(box(1.52, .15, 4.42, '#fff', 0, .85, 0));                // stripe
      g.add(box(1.3, .3, .05, '#1a1a1a', 0, 1.6, -2.21));            // route board
      for (const z of [-1.4, 1.4]) { g.add(wheel(.3, -.75, .3, z)); g.add(wheel(.3, .75, .3, z)); }
      for (let i = 0; i < 4; i++) g.add(box(.4, .4, .4, '#7a6a5a', -.4 + (i % 2) * .7, 2.05, -1.2 + i * .7)); // luggage on the roof
      return g;
    } },
    cart: { h: .75, len: 1.2, make() {
      const g = new THREE.Group();
      g.add(box(1.3, .08, 1.0, '#9a6b3f', 0, .45, 0));
      g.add(wheel(.25, -.7, .25, 0)); g.add(wheel(.25, .7, .25, 0));
      const fruit = ['#ff7a00', '#ffd400', '#e83a3a', '#5cbf3a'];
      for (let i = 0; i < 9; i++) g.add(ball(.13, fruit[i % 4], -.4 + (i % 3) * .4, .65, -.3 + Math.floor(i / 3) * .3));
      return g;
    } },
    barrier: { h: .8, len: .4, make() {
      const g = new THREE.Group();
      for (const x of [-.6, .6]) g.add(box(.08, .75, .08, '#333', x, 0, 0));
      for (let i = 0; i < 4; i++) g.add(box(.32, .3, .06, i % 2 ? '#111' : '#ffd400', -.48 + i * .32, .4, 0));
      return g;
    } },
    pothole: { h: .3, len: 1.2, make() {
      const g = new THREE.Group();
      const hole = new THREE.Mesh(new THREE.CircleGeometry(.65, 10), mat('#3a3020')); hole.rotation.x = -Math.PI / 2; hole.position.y = .03; hole.scale.y = 1.3; g.add(hole);
      const water = new THREE.Mesh(new THREE.CircleGeometry(.45, 10), mat('#5c87a8')); water.rotation.x = -Math.PI / 2; water.position.y = .04; g.add(water);
      for (let i = 0; i < 3; i++) g.add(box(.25, .2, .25, '#ff7a00', -.5 + i * .5, 0, -.8)); // warning cones
      return g;
    } },
  };

  // ---------- pickups ----------
  const coinGeo = new THREE.CylinderGeometry(.28, .28, .07, 14);
  const coinMat = new THREE.MeshLambertMaterial({ color: '#ffcc33', emissive: '#7a5200' });
  const POWERS = {
    magnet: { color: '#e83a3a', label: '🧲 Magnet', secs: 8 },
    nitro: { color: '#2bc8ff', label: '⚡ Nitro', secs: 5 },
    double: { color: '#43d96b', label: '✖️2 Coins', secs: 10 },
    passenger: { color: '#ff8ad8', label: '🙋 Passenger', secs: 0 },
  };
  function powerModel(type) {
    const g = new THREE.Group(), c = POWERS[type].color;
    if (type === 'magnet') { const t = mesh(new THREE.TorusGeometry(.3, .1, 6, 12, Math.PI), c, 0, .9, 0); t.rotation.z = Math.PI; g.add(t); g.add(box(.2, .12, .2, '#ddd', -.3, .78, 0)); g.add(box(.2, .12, .2, '#ddd', .3, .78, 0)); }
    else if (type === 'nitro') { g.add(mesh(new THREE.OctahedronGeometry(.35, 0), c, 0, .9, 0)); }
    else if (type === 'double') { for (let i = 0; i < 3; i++) g.add(cyl(.25, .25, .08, '#43d96b', 0, .65 + i * .12, 0, 12)); }
    else { g.add(cyl(.15, .2, .55, c, 0, .3, 0, 6)); g.add(ball(.16, '#c68a5c', 0, 1.0, 0)); g.add(box(.6, .08, .08, c, .25, .75, 0)); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .04, 6, 20), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    ring.position.y = .9; g.add(ring);
    return g;
  }

  // ---------- the street ----------
  const SEG = 20, SEGS = 6, SPAN = SEG * SEGS;
  const road = [];
  for (let i = 0; i < SEGS; i++) {
    const g = new THREE.Group();
    g.add(box(6.2, .1, SEG, '#5d6170', 0, -.1, 0));
    for (const x of [-.85, .85]) for (let z = -SEG / 2 + 1; z < SEG / 2; z += 3) g.add(box(.1, .02, 1.4, '#ffffff', x, 0, z));
    for (const x of [-3.6, 3.6]) g.add(box(1.0, .25, SEG, '#c9b99a', x, -.1, 0));      // footpaths
    for (const x of [-3.1, 3.1]) for (let z = -SEG / 2; z < SEG / 2; z += 1) g.add(box(.12, .14, .98, z % 2 === 0 ? '#ffd400' : '#222', x, 0, z + .5)); // painted kerb
    g.add(box(60, .05, SEG, '#d8c79a', 0, -.2, 0));                                   // dusty ground
    g.position.z = -i * SEG + SEG / 2;
    scene.add(g); road.push(g);
  }

  const SHOP_COLORS = ['#ff8fab', '#7ad7c4', '#ffd166', '#a28cf2', '#ff9f68', '#8fd3ff', '#f4f1de', '#c5e1a5'];
  const SIGNS = ['#e63946', '#2a9d8f', '#f4a261', '#264653', '#e76f51', '#6a4c93'];
  function buildingModel() {
    const g = new THREE.Group(), w = 2.2 + Math.random() * 1.6, h = 2 + Math.random() * 4, d = 2.5 + Math.random();
    const c = SHOP_COLORS[Math.floor(Math.random() * SHOP_COLORS.length)];
    g.add(box(w, h, d, c, 0, 0, 0));
    g.add(box(w * .9, .5, .1, SIGNS[Math.floor(Math.random() * SIGNS.length)], 0, 1.2, d / 2 + .05)); // shop sign
    g.add(box(w * .7, .9, .06, '#3b3b3b', 0, 0, d / 2 + .03));                                     // shutter
    g.add(box(w * .95, .08, .6, '#8d6e63', 0, 1.0, d / 2 + .3));                                  // awning
    for (let f = 1; f < h / 1.3; f++) for (let i = 0; i < 2; i++) g.add(box(.45, .5, .05, '#2f4b6e', -w / 4 + i * w / 2, .9 + f * 1.1, d / 2 + .03));
    if (Math.random() < .7) g.add(cyl(.35, .35, .5, '#222', w / 4, h, 0, 8));                     // black water tank
    if (Math.random() < .3) g.add(box(.4, .3, .2, '#ddd', -w / 4, h * .6, d / 2 + .1));          // AC unit
    return g;
  }
  function treeModel() {
    const g = new THREE.Group();
    g.add(cyl(.12, .16, 1.2, '#7a5230', 0, 0, 0, 6));
    g.add(ball(.8, '#4e9a3a', 0, 1.7, 0)); g.add(ball(.55, '#62b549', .4, 2.1, .2));
    return g;
  }
  function lampModel() {
    const g = new THREE.Group();
    g.add(cyl(.05, .07, 3, '#555', 0, 0, 0, 6));
    g.add(box(.8, .06, .1, '#555', -.4, 3, 0)); g.add(box(.25, .1, .2, '#fff6c0', -.75, 2.9, 0));
    return g;
  }
  function templeModel() {
    const g = new THREE.Group();
    g.add(box(2.6, 1.6, 2.6, '#fff1e0', 0, 0, 0));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(1.1 - i * .22, .9, 8), i % 2 ? '#ff9933' : '#ffcc80', 0, 2.0 + i * .55, 0));
    g.add(box(.6, .35, .02, '#ff9933', .35, 3.9, 0));
    return g;
  }
  const decor = [];
  function placeDecor(side, z) {
    const r = Math.random();
    const g = r < .72 ? buildingModel() : r < .88 ? treeModel() : r < .96 ? lampModel() : templeModel();
    g.position.set(side * (5.6 + Math.random() * .8), 0, z);
    if (g.children.length > 3 && r < .72) g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (r >= .88 && r < .96) { g.position.x = side * 4.3; g.rotation.y = side > 0 ? 0 : Math.PI; }
    scene.add(g); decor.push({ g, side });
  }
  for (const side of [-1, 1]) for (let z = 8; z > -SPAN; z -= 3.4) placeDecor(side, z);

  // ---------- game state ----------
  const G = { state: 'menu', speed: 0, dist: 0, coins: 0, lane: 1, x: 0, y: 0, vy: 0, objs: [], nextSpawn: 30, power: {}, crashT: 0, tilt: 0 };
  let player = rickshawModel(skin());
  scene.add(player); scene.add(player.userData.shadow);

  function setSkin() { scene.remove(player); scene.remove(player.userData.shadow); player = rickshawModel(skin()); scene.add(player); scene.add(player.userData.shadow); }

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
      const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2;
      const cz = z + 6 - i * 1.6;
      c.position.set(LANES[cl], .7, cz);
      scene.add(c);
      G.objs.push({ kind: 'coin', lane: cl, z: cz, g: c });
    }
    if (Math.random() < .12) {
      const types2 = Object.keys(POWERS), pt = types2[Math.floor(Math.random() * types2.length)];
      const pl = open[(open.indexOf(cl) + 1) % open.length], g = powerModel(pt);
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
    Sound.music('campaign');
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
      if (paused) { const p = document.createElement('div'); p.className = 'pausebox'; p.innerHTML = '<b>⏸ Paused</b><button class="btn green big" data-a="pause">▶ Resume</button><button class="btn ghost" data-a="quit">Quit</button>'; $('#app').appendChild(p); }
      else { const p = $('.pausebox'); if (p) p.remove(); }
    },
    quit() { paused = false; const p = $('.pausebox'); if (p) p.remove(); G.state = 'menu'; for (const o of G.objs) scene.remove(o.g); G.objs = []; showMenu(); },
    horn() { Sound.play('bus'); },
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
    for (const r of road) { r.position.z += v * dt; if (r.position.z > SEG * 1.5) r.position.z -= SPAN; }
    for (const d of decor) { d.g.position.z += v * dt; if (d.g.position.z > 12) d.g.position.z -= SPAN + 12; }

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
    player.children.forEach(c => { if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.rotation.z) c.rotation.x -= v * dt * 3; });

    if (running) {
      // spawn ahead
      G.nextSpawn -= v * dt;
      if (G.nextSpawn <= 0) { spawnRow(-90); G.nextSpawn = Math.max(11, 20 - G.dist / 300); }
      const magnet = G.power.magnet > 0;
      for (const o of G.objs) {
        o.z += v * dt; o.g.position.z = o.z;
        if (o.kind === 'coin') {
          o.g.rotation.z += dt * 4;
          if (magnet && o.z > -14 && o.z < 1) { o.g.position.x += (G.x - o.g.position.x) * dt * 8; o.g.position.y += (G.y + .7 - o.g.position.y) * dt * 8; }
          const near = Math.abs(o.z) < .9 && Math.abs(o.g.position.x - G.x) < .9 && Math.abs(o.g.position.y - (G.y + .7)) < 1;
          if (near) { o.dead = true; G.coins += G.power.double > 0 ? 2 : 1; Sound.play('pop'); }
        } else if (o.kind === 'power') {
          o.g.rotation.y += dt * 3;
          if (Math.abs(o.z) < 1 && o.lane === G.lane) {
            o.dead = true;
            if (o.type === 'passenger') { G.coins += 25; Sound.play('win'); toast('🙋 Passenger! +25 coins'); }
            else { G.power[o.type] = POWERS[o.type].secs; Sound.play('good'); toast(POWERS[o.type].label + '!'); }
            buzz(20);
          }
        } else if (o.kind === 'obs') {
          const hit = Math.abs(o.z) < o.len / 2 + .7 && o.lane === G.lane && Math.abs(G.x - LANES[o.lane]) < 1.1 && G.y < o.h;
          if (hit) {
            if (G.power.nitro > 0) { o.dead = true; Sound.play('stamp'); toast('⚡ SMASH!'); }
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
    requestAnimationFrame(loop);
  }

  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.className = 'toast show';
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'toast'; }, 1200);
  }

  resize();
  showMenu();
  requestAnimationFrame(loop);
  window.RR = { G, start, crash, spawnRow }; // handy for testing
})();
