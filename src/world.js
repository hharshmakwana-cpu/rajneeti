// RAJNEETI 3D — the town scene: island, ring road, buildings, people, the RSP jeep,
// camera controls and tapping.

const World = (() => {
  let renderer, scene, camera, sun, root, landGroup, L = 0;
  const meshes = new Map();        // building id -> { group, key }
  const frameFns = [];
  const people = [];
  let jeep = null, ghost = null;
  let onTile = () => {}, onBuilding = () => {}, onJeep = () => {};
  const cam = { tx: 0, tz: 0, dist: 14, yaw: Math.PI / 4, pitch: .92 };
  let el;

  const tileToWorld = (x, z, size = 1) => new THREE.Vector3(x - L / 2 + size / 2, 0, z - L / 2 + size / 2);

  let sea = null, seaBase = null;
  const boats = [], clouds = [];

  function init(container) {
    el = container;
    THREE.ColorManagement.legacyMode = false;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const HAZE = '#d9ecf5';
    scene.background = new THREE.Color(HAZE);
    scene.fog = new THREE.Fog(HAZE, 45, 110);
    camera = new THREE.PerspectiveCamera(38, 1, .1, 260);
    // sky dome and the matching image-based light
    const dome = r => {
      const geo = new THREE.SphereGeometry(r, 32, 16), p = geo.attributes.position, col = [];
      const top = new THREE.Color('#4f9fe0'), mid = new THREE.Color('#a8d4f2'), hor = new THREE.Color(HAZE), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / r; if (y > .2) c.copy(mid).lerp(top, (y - .2) / .8); else c.copy(hor).lerp(mid, Math.max(0, y) / .2); col.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    };
    scene.add(dome(220));
    {
      const env = new THREE.Scene(); env.add(dome(10));
      const s = new THREE.Mesh(new THREE.SphereGeometry(.8, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4d6' })); s.position.set(5, 7, 4); env.add(s);
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .02).texture; pm.dispose();
    }
    scene.add(new THREE.HemisphereLight('#e2f1ff', '#8a9a6a', .55));
    sun = new THREE.DirectionalLight('#fff0d8', 1.7);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -.0005; sun.shadow.normalBias = .02;
    scene.add(sun); scene.add(sun.target);

    // the sea: a gently moving, shiny surface
    const sg = new THREE.PlaneGeometry(240, 240, 60, 60); sg.rotateX(-Math.PI / 2);
    sea = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#1f8fc8', roughness: .18, metalness: .25 }));
    sea.position.y = -.42; sea.receiveShadow = true; seaBase = sg.attributes.position.array.slice();
    scene.add(sea);
    for (let i = 0; i < 3; i++) { const b = boat(); scene.add(b); boats.push({ g: b, a: i * 2.1, r: 20 + i * 4 }); }
    for (let i = 0; i < 7; i++) { const c = RM.cloud(); c.scale.setScalar(.6); c.position.set((Math.random() - .5) * 140, 26 + Math.random() * 10, (Math.random() - .5) * 140); scene.add(c); clouds.push(c); }
    root = new THREE.Group(); scene.add(root);

    resize();
    addEventListener('resize', resize);
    bindControls();
    requestAnimationFrame(loop);
  }

  // a small fishing boat with a sail
  function boat() {
    const { RB, cyl, profile } = RM.kit, M = RM.M, g = new THREE.Group();
    g.add(new THREE.Mesh(profile([[-1.6, .3], [1.6, .3], [2.1, .9, 2, .4], [-2, .9], [-1.9, .5, -2, .4]], 1.1, .08), M(['#1565c0', '#c62828', '#2e7d32'][Math.floor(Math.random() * 3)], { roughness: .5 })));
    g.add(RB(3.4, .1, 1, .03, M('#8a5a34'), 0, .85, 0));
    g.add(cyl(.05, .05, 3.2, M('#6d4c41'), 0, 2.4, 0, 6));
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.6, 0), new THREE.Vector2(0, 2.6)])), M('#f5ecd7', { side: THREE.DoubleSide, roughness: .9 }));
    sail.position.set(.05, 1.1, 0); g.add(sail);
    const out = RM.bake(g); out.scale.setScalar(.3); return out;
  }

  function resize() {
    const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- the island ----------
  const landTex = {};
  function grassTex() {
    if (landTex.grass) return landTex.grass;
    const { canvas, tex, grain } = RT, [c, g] = canvas(256, 256);
    g.fillStyle = '#67a646'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '40,90,30' : '150,200,90'},${Math.random() * .25})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 14, 0, 7); g.fill(); }
    for (let i = 0; i < 5000; i++) { g.strokeStyle = `rgba(${Math.random() < .5 ? '50,110,35' : '160,210,100'},.5)`; const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 2 - 1, y - 3 - Math.random() * 3); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254); // faint plot lines
    grain(g, 256, 256, .1, 4000);
    landTex.grass = tex(c); landTex.grass.wrapS = landTex.grass.wrapT = THREE.RepeatWrapping;
    return landTex.grass;
  }
  function roadTex() {
    if (landTex.road) return landTex.road;
    const { canvas, tex, grain } = RT, [c, g] = canvas(128, 128);
    g.fillStyle = '#5a5d63'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '30,30,34' : '110,108,104'},.15)`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 16, 0, 7); g.fill(); }
    grain(g, 128, 128, .2, 6000);
    g.fillStyle = 'rgba(250,245,235,.9)'; g.fillRect(61, 10, 6, 54);   // centre dash
    g.fillStyle = 'rgba(245,215,80,.9)'; g.fillRect(4, 0, 4, 128); g.fillRect(120, 0, 4, 128);
    landTex.road = tex(c); landTex.road.wrapS = landTex.road.wrapT = THREE.RepeatWrapping;
    return landTex.road;
  }
  function sandTex() {
    if (landTex.sand) return landTex.sand;
    const { canvas, tex, grain } = RT, [c, g] = canvas(128, 128);
    g.fillStyle = '#e9d6a6'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '190,165,115' : '250,240,210'},.3)`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 8, 0, 7); g.fill(); }
    grain(g, 128, 128, .2, 5000);
    landTex.sand = tex(c); landTex.sand.wrapS = landTex.sand.wrapT = THREE.RepeatWrapping;
    return landTex.sand;
  }

  function buildLand(size) {
    if (landGroup) root.remove(landGroup);
    L = size;
    landGroup = new THREE.Group();
    const R = L + 2; // land plus a ring road
    const M = RM.M, { RB } = RM.kit, deco = new THREE.Group();
    // beach and rocky cliff
    const st = sandTex().clone(); st.needsUpdate = true; st.repeat.set(R / 2, R / 2);
    const beach = new THREE.Mesh(RM.rbox(R + 2.4, .6, R + 2.4, .5, 3), new THREE.MeshStandardMaterial({ map: st, roughness: 1 }));
    beach.position.y = -.62; deco.add(beach);
    for (let i = 0; i < 26; i++) { // rocks along the shore
      const a = i / 26 * Math.PI * 2, r = (R + 2.4) / 2 * (1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.1 + Math.random() * .12, 1), M('#8c8578', { roughness: 1 }));
      rock.position.set(Math.cos(a) * r, -.45, Math.sin(a) * r); rock.scale.y = .6; rock.rotation.set(Math.random(), Math.random(), 0); deco.add(rock);
    }
    // ring road: asphalt with a centre line, and a kerb
    const rt = roadTex();
    const off = R / 2 - .5;
    for (const [len, rz, x, z] of [[R, Math.PI / 2, 0, off], [R, Math.PI / 2, 0, -off], [R - 2, 0, off, 0], [R - 2, 0, -off, 0]]) {
      const t = rt.clone(); t.needsUpdate = true; t.repeat.set(1, len);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, len), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }));
      strip.rotation.set(-Math.PI / 2, 0, rz); strip.position.set(x, -.01, z);
      deco.add(strip);
    }
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(R + .3, R + .3), M('#b8b0a2', { roughness: 1 }));
    pave.position.y = -.03; pave.rotation.x = -Math.PI / 2; deco.add(pave);
    // kerb around the land
    const kerbY = M('#f2c230', { roughness: .7 }), kerbB = M('#222', { roughness: .7 });
    for (let i = 0; i < L * 2; i++) for (const [x, z, ry] of [[-L / 2 + i * .5 + .25, -L / 2 - .04, 0], [-L / 2 + i * .5 + .25, L / 2 + .04, 0], [-L / 2 - .04, -L / 2 + i * .5 + .25, 1], [L / 2 + .04, -L / 2 + i * .5 + .25, 1]]) {
      const k = RB(.5, .08, .08, .02, i % 2 ? kerbB : kerbY, x, .02, z); if (ry) k.rotation.y = Math.PI / 2; deco.add(k);
    }
    // grass you can build on (tiles stay invisible, only for tapping)
    const gt = grassTex().clone(); gt.needsUpdate = true; gt.repeat.set(L, L);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, L), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = .02; deco.add(grass);
    const baked = RM.bake(deco, { cast: false });
    baked.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    landGroup.add(baked);
    const tiles = new THREE.Group(), tileGeo = new THREE.BoxGeometry(.98, .08, .98), tileMat = new THREE.MeshBasicMaterial();
    for (let x = 0; x < L; x++) for (let z = 0; z < L; z++) {
      const p = tileToWorld(x, z);
      const t = new THREE.Mesh(tileGeo, tileMat);
      t.position.set(p.x, -.02, p.z); t.visible = false;
      t.userData.tile = { x, z };
      tiles.add(t);
    }
    landGroup.add(tiles);
    landGroup.userData.tiles = tiles;
    // palms on the beach, lamps along the road
    const scenery = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + .2, r = (R + 1.6) / 2 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const p = RM.palm(); p.scale.setScalar(.16 + Math.random() * .04); p.position.set(Math.cos(a) * r, -.32, Math.sin(a) * r); p.rotation.y = Math.random() * 6; scenery.add(p);
    }
    for (let i = 0; i < 4; i++) for (const f of [.25, .75]) {
      const lamp = RM.lamp(); lamp.scale.setScalar(.15);
      const side = R / 2 + .05, along = -R / 2 + f * R;
      const pos = [[along, side], [side, along], [along, -side], [-side, along]][i];
      lamp.position.set(pos[0], 0, pos[1]); lamp.rotation.y = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][i]; scenery.add(lamp);
    }
    landGroup.add(scenery);
    root.add(landGroup);
    const s = sun.shadow.camera; s.left = s.bottom = -R; s.right = s.top = R; s.updateProjectionMatrix();
    cam.dist = 9 + L * 1.25;
    spawnPeople();
  }

  // ---------- buildings ----------
  function sync(state) {
    if (landSize() !== L) { buildLand(landSize()); for (const m of meshes.values()) root.remove(m.group); meshes.clear(); }
    const seen = new Set();
    for (const b of state.buildings) {
      seen.add(b.id);
      const d = BUILDINGS[b.type], done = built(b);
      const key = `${b.type}:${b.level}:${done}:${b.x},${b.z}:${state.color}`;
      const cur = meshes.get(b.id);
      if (cur && cur.key === key) continue;
      if (cur) root.remove(cur.group);
      const g = done ? Models.build(b.type, b.level, state.color) : Models.scaffold(d.size);
      const p = tileToWorld(b.x, b.z, d.size);
      g.position.copy(p);
      g.userData.buildingId = b.id;
      g.traverse(o => { o.userData.buildingId = b.id; });
      g.scale.setScalar(.01);
      g.userData.pop = 0; // grows in with a bounce
      root.add(g);
      meshes.set(b.id, { group: g, key });
    }
    for (const [id, m] of meshes) if (!seen.has(id)) { root.remove(m.group); meshes.delete(id); }
  }

  function anchor(id) {
    const m = meshes.get(id);
    if (!m) return null;
    const box = new THREE.Box3().setFromObject(m.group);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + .25, (box.min.z + box.max.z) / 2);
  }
  function project(v) {
    const p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * el.clientWidth, y: (1 - p.y) / 2 * el.clientHeight, behind: p.z > 1 };
  }
  function jiggle(id) { const m = meshes.get(id); if (m) m.group.userData.pop = .6; }

  // ---------- placing a new building ----------
  function setGhost(type, x, z, ok) {
    if (ghost) { root.remove(ghost); ghost = null; }
    if (!type) return;
    ghost = Models.build(type, 1, S.color);
    ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .65; o.castShadow = false; } });
    const size = BUILDINGS[type].size;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(size * .98, .03, size * .98), new THREE.MeshBasicMaterial({ color: ok ? '#4ade80' : '#f87171', transparent: true, opacity: .7 }));
    pad.position.y = .04;
    ghost.add(pad);
    ghost.position.copy(tileToWorld(x, z, size));
    root.add(ghost);
  }

  // ---------- people and the jeep ----------
  function ringPoint(t) {
    // t in [0,1) around the ring road
    const R = L + 2, half = R / 2 - .5, side = Math.floor(t * 4) % 4, f = (t * 4) % 1, a = -half + f * 2 * half;
    return [[a, -half], [half, a], [-a, half], [-half, -a]][side];
  }
  function spawnPeople() {
    for (const p of people) root.remove(p.g);
    people.length = 0;
    const colors = ['#e94f37', '#3aa0e8', '#f2b632', '#6bbf59', '#a26dd6', '#ff8a5b', '#ffffff', S ? S.color : '#10b981'];
    for (let i = 0; i < 6 + L; i++) {
      const g = Models.person(colors[i % colors.length]);
      g.userData.phase = Math.random() * 6;
      root.add(g);
      people.push({ g, t: Math.random(), v: (.006 + Math.random() * .01) * (Math.random() < .5 ? 1 : -1), off: (Math.random() - .5) * .4 });
    }
  }
  function startJeep() {
    if (jeep) return;
    jeep = { g: Models.jeep(), t: Math.random() };
    jeep.g.traverse(o => { o.userData.jeep = true; });
    root.add(jeep.g);
    jeep.left = 1; // fraction of a lap to drive before escaping
  }
  function stopJeep(caught) {
    if (!jeep) return;
    const j = jeep; jeep = null;
    if (caught) {
      j.g.userData.flip = 0;
      const spin = () => { j.g.rotation.z += .35; j.g.position.y += .06; j.g.scale.multiplyScalar(.93); if (j.g.scale.x > .1) requestAnimationFrame(spin); else root.remove(j.g); };
      spin();
    } else root.remove(j.g);
  }

  // ---------- camera controls: drag to move, pinch or wheel to zoom ----------
  function bindControls() {
    const c = renderer.domElement, pts = new Map();
    let moved = 0, pinch0 = 0, dist0 = 0;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist; } c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        cam.dist = clampN(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 5, 8 + L * 1.6);
        moved = 99; return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        // the town follows your finger: right = screen right on the ground, f = into the screen
        const k = cam.dist / el.clientHeight * 1.5;
        const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
        cam.tx += (-dx * rx + dy * fx) * k;
        cam.tz += (-dx * rz + dy * fz) * k;
        const lim = L / 2 + 1; cam.tx = clampN(cam.tx, -lim, lim); cam.tz = clampN(cam.tz, -lim, lim);
      }
    });
    const up = e => {
      const wasTap = pts.size === 1 && moved <= 6;
      pts.delete(e.pointerId);
      if (wasTap) tap(e.clientX, e.clientY);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', e => pts.delete(e.pointerId));
    c.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clampN(cam.dist * (e.deltaY > 0 ? 1.1 : .9), 5, 8 + L * 1.6); }, { passive: false });
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  const ray = new THREE.Raycaster();
  function tap(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
    const hits = ray.intersectObjects(root.children, true);
    for (const h of hits) {
      const u = h.object.userData;
      if (u.jeep) return onJeep();
      if (u.buildingId && !ghost) return onBuilding(u.buildingId);
      if (u.tile) return onTile(u.tile.x, u.tile.z);
    }
  }

  // ---------- animation ----------
  let t0 = performance.now();
  function loop(t) {
    const dt = Math.min(.05, (t - t0) / 1000); t0 = t;
    const time = t / 1000;
    // camera
    const y = Math.sin(cam.pitch) * cam.dist, h = Math.cos(cam.pitch) * cam.dist;
    camera.position.set(cam.tx + Math.sin(cam.yaw) * h, y, cam.tz + Math.cos(cam.yaw) * h);
    camera.lookAt(cam.tx, 0, cam.tz);
    sun.position.set(cam.tx + 8, 14, cam.tz + 6); sun.target.position.set(cam.tx, 0, cam.tz);
    // buildings pop in and idle animations
    for (const { group } of meshes.values()) {
      const u = group.userData;
      if (u.pop !== undefined && u.pop < 1) {
        // ease-out-back: grows past full size, then settles
        u.pop = Math.min(1, u.pop + dt * 2.2);
        const x = u.pop - 1;
        group.scale.setScalar(Math.max(.01, 1 + 2.70158 * x * x * x + 1.70158 * x * x));
      }
      if (u.tick) u.tick(time, dt);
      if (u.sway !== undefined) group.children[0].rotation.z = Math.sin(time * 1.4 + u.sway) * .02;
    }
    // people stroll along the ring road
    for (const p of people) {
      p.t = (p.t + p.v * dt * 4 + 1) % 1;
      const [x, z] = ringPoint(p.t);
      p.g.position.set(x + p.off * .5, 0, z + p.off * .5);
      p.g.userData.walk(time * .8 + p.g.userData.phase);
      const [x2, z2] = ringPoint((p.t + Math.sign(p.v) * .01 + 1) % 1);
      p.g.rotation.y = Math.atan2(x2 - x, z2 - z);
    }
    if (jeep) {
      jeep.t = (jeep.t + dt * .045) % 1; jeep.left -= dt * .045;
      const [x, z] = ringPoint(jeep.t), [x2, z2] = ringPoint((jeep.t + .01) % 1);
      jeep.g.position.set(x, Math.abs(Math.sin(time * 14)) * .02, z);
      jeep.g.rotation.y = Math.atan2(x2 - x, z2 - z) - Math.PI / 2;
      if (jeep.g.userData.tick) jeep.g.userData.tick(time * 1.6, dt);
      if (jeep.left <= 0) { onJeep(true); }
    }
    // waves, boats and clouds
    const sp = sea.geometry.attributes.position, sa = sp.array;
    for (let i = 0; i < sp.count; i++) sa[i * 3 + 1] = seaBase[i * 3 + 1] + Math.sin(seaBase[i * 3] * .35 + time * 1.2) * .06 + Math.cos(seaBase[i * 3 + 2] * .4 + time) * .05;
    sp.needsUpdate = true; sea.geometry.computeVertexNormals();
    for (const b of boats) { b.a += dt * .03; b.g.position.set(Math.cos(b.a) * b.r, -.35 + Math.sin(time * 1.5 + b.r) * .05, Math.sin(b.a) * b.r); b.g.rotation.y = -b.a; b.g.rotation.z = Math.sin(time * 1.3 + b.r) * .05; }
    for (const c of clouds) { c.position.x += dt * .4; if (c.position.x > 80) c.position.x -= 160; }
    for (const f of frameFns) f(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function focus(x, z, size = 1) { const p = tileToWorld(x, z, size); cam.tx = p.x; cam.tz = p.z; }

  return {
    init, sync, anchor, project, jiggle, setGhost, startJeep, stopJeep, focus, resize,
    get jeepActive() { return !!jeep; },
    onFrame: f => frameFns.push(f),
    onTapTile: f => { onTile = f; }, onTapBuilding: f => { onBuilding = f; }, onTapJeep: f => { onJeep = f; },
    tileToWorld,
  };
})();
