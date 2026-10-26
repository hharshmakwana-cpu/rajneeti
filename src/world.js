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

  function init(container) {
    el = container;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8fd3ff');
    scene.fog = new THREE.Fog('#8fd3ff', 30, 70);
    camera = new THREE.PerspectiveCamera(38, 1, .1, 200);

    scene.add(new THREE.HemisphereLight('#ffffff', '#6a8a4a', .65));
    sun = new THREE.DirectionalLight('#fff2d6', 1.05);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -.0008;
    scene.add(sun); scene.add(sun.target);

    // sea with a few low-poly waves
    const sea = new THREE.Mesh(new THREE.CircleGeometry(80, 24), new THREE.MeshStandardMaterial({ color: '#3fb0e8', roughness: .4, flatShading: true }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -.35; sea.receiveShadow = true;
    scene.add(sea);
    root = new THREE.Group(); scene.add(root);

    resize();
    addEventListener('resize', resize);
    bindControls();
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- the island ----------
  function buildLand(size) {
    if (landGroup) root.remove(landGroup);
    L = size;
    landGroup = new THREE.Group();
    const R = L + 2; // land plus a ring road
    // cliff and beach
    landGroup.add(Models.box(R + 1.4, .5, R + 1.4, '#e8d29a', 0, -.55, 0));
    landGroup.add(Models.box(R + .6, .5, R + .6, '#7a5a3a', 0, -.5, 0));
    // ring road with dashes
    landGroup.add(Models.box(R, .06, R, '#6d7280', 0, -.05, 0));
    for (let i = 0; i < R; i += .6) for (const [x, z, rot] of [[i - R / 2 + .3, -R / 2 + .5, 0], [i - R / 2 + .3, R / 2 - .5, 0], [-R / 2 + .5, i - R / 2 + .3, 1], [R / 2 - .5, i - R / 2 + .3, 1]]) {
      const d = Models.box(.25, .01, .05, '#ffd166', x, .01, z); if (rot) d.rotation.y = Math.PI / 2; landGroup.add(d);
    }
    // grass tiles you can build on
    const tiles = new THREE.Group();
    for (let x = 0; x < L; x++) for (let z = 0; z < L; z++) {
      const p = tileToWorld(x, z);
      const t = new THREE.Mesh(new THREE.BoxGeometry(.98, .08, .98), Models.mat((x + z) % 2 ? '#7cc95a' : '#86d163'));
      t.position.set(p.x, -.02, p.z); t.receiveShadow = true;
      t.userData.tile = { x, z };
      tiles.add(t);
    }
    landGroup.add(tiles);
    landGroup.userData.tiles = tiles;
    // palm trees on the beach corners
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const t = Models.build('tree'); t.position.set(x * (R / 2 + .35), -.3, z * (R / 2 + .35)); t.scale.setScalar(1.3); landGroup.add(t);
    }
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
      group.traverse(o => {
        if (o.userData.flag) o.scale.x = 1 + Math.sin(time * 6 + o.id) * .08, o.rotation.y = Math.sin(time * 3 + o.id) * .15;
        if (o.userData.spin) o.rotation.y = time * .6;
        if (o.userData.blink) o.visible = Math.sin(time * 5) > 0;
        if (o.userData.bob !== undefined) o.position.y = Math.abs(Math.sin(time * 5 + o.userData.bob)) * .05;
        if (o.userData.sway !== undefined) o.rotation.z = Math.sin(time * 1.4 + o.userData.sway) * .03;
      });
    }
    // people stroll along the ring road
    for (const p of people) {
      p.t = (p.t + p.v * dt * 4 + 1) % 1;
      const [x, z] = ringPoint(p.t);
      p.g.position.set(x + p.off * .5, Math.abs(Math.sin(time * 9 + p.off * 10)) * .03, z + p.off * .5);
      const [x2, z2] = ringPoint((p.t + Math.sign(p.v) * .01 + 1) % 1);
      p.g.rotation.y = Math.atan2(x2 - x, z2 - z);
    }
    if (jeep) {
      jeep.t = (jeep.t + dt * .045) % 1; jeep.left -= dt * .045;
      const [x, z] = ringPoint(jeep.t), [x2, z2] = ringPoint((jeep.t + .01) % 1);
      jeep.g.position.set(x, Math.abs(Math.sin(time * 14)) * .02, z);
      jeep.g.rotation.y = Math.atan2(x2 - x, z2 - z) - Math.PI / 2;
      jeep.g.traverse(o => { if (o.userData.flag) o.scale.x = 1 + Math.sin(time * 10) * .1; });
      if (jeep.left <= 0) { onJeep(true); }
    }
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
