// RICKSHAW RUSH — the 3D models, all built in code: the auto-rickshaw, people,
// a zebu cow, a state bus, fruit cart, police barricade, shops, trees, palms,
// shrines, electric poles, bunting and a mobile tower.
// Static models are baked into a few meshes so phones can draw a whole street.

const RM = (() => {
  const { pick, rnd } = RT;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- materials ----------
  const mats = new Map();
  function M(color, o = {}) {
    const key = color + JSON.stringify(o);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, ...o }));
    return mats.get(key);
  }
  const CHROME = () => M('#e8e8e8', { roughness: .25, metalness: .9 });
  const RUBBER = () => M('#1c1c1e', { roughness: .9 });
  const GLASS = () => M('#9cc8e6', { roughness: .08, metalness: .2, transparent: true, opacity: .45 });
  const GLOW = c => M(c, { emissive: c, emissiveIntensity: .9, roughness: .3 });

  const rot = (o, axis, v) => { o.rotation[axis] = v; return o; };
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };

  // A box with rounded edges and smooth normals: the basic shape of most things here.
  function rbox(w, h, d, r = .05, s = 2) {
    r = Math.min(r, w / 2, h / 2, d / 2) * .999;
    const n = 2 * s + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    const p = g.attributes.position, nm = g.attributes.normal, half = [w / 2, h / 2, d / 2];
    const v = V(0, 0, 0), c = V(0, 0, 0), diff = V(0, 0, 0);
    const map = (t, hf) => { const k = Math.round((t + .5) * n); return k <= s ? -hf + r * k / s : hf - r * (n - k) / s; };
    for (let i = 0; i < p.count; i++) {
      v.set(map(p.getX(i), half[0]), map(p.getY(i), half[1]), map(p.getZ(i), half[2]));
      c.set(THREE.MathUtils.clamp(v.x, -half[0] + r, half[0] - r), THREE.MathUtils.clamp(v.y, -half[1] + r, half[1] - r), THREE.MathUtils.clamp(v.z, -half[2] + r, half[2] - r));
      diff.subVectors(v, c);
      if (diff.lengthSq() > 1e-10) { diff.normalize(); v.copy(c).addScaledVector(diff, r); nm.setXYZ(i, diff.x, diff.y, diff.z); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  const RB = (w, h, d, r, m, x, y, z) => mesh(rbox(w, h, d, r), m, x, y, z);
  const cyl = (r1, r2, h, m, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z);
  const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, seg = r < .06 ? 8 : 16) => { const o = mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .75)), m, x, y, z); o.scale.set(sx, sy, sz); return o; };
  const cap = (r, len, m, x, y, z) => mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m, x, y, z);
  const tube = (pts, r, m, seg = 24, closed = false) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, closed), m);
  const lathe = (pts, m, x, y, z, seg = 24) => mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), m, x, y, z);
  // Extrude a side profile (x = forward, y = up) across the width, centred.
  function profile(points, width, bevel = .04, curved = []) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]);
    }
    const depth = Math.max(.01, width - bevel * 2);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -depth / 2);
    g.rotateY(Math.PI / 2); // profile x now points along -z (forward)
    return g;
  }

  // Merge every static mesh of a model into as few meshes as possible. Plain
  // coloured parts share one vertex-coloured material, so a whole shop or
  // person costs the phone only a couple of draw calls.
  const MONO = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }),
  };
  function bake(group, { cast = true, receive = true } = {}) {
    group.updateMatrixWorld(true);
    const inv = group.matrixWorld.clone().invert(), rel = o => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const buckets = new Map(), keep = [];
    group.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (Array.isArray(m) || o.userData.keep) { keep.push(o); return; }
      const glows = m.emissive && m.emissive.getHex() && m.emissiveIntensity > .3;
      const plain = !m.map && !m.transparent && !glows && m.side === THREE.FrontSide && (!m.vertexColors || o.geometry.attributes.color);
      const key = plain ? (m.metalness > .5 ? 'metal' : 'matte') : m;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });
    const out = new THREE.Group();
    for (const [key, list] of buckets) {
      const mono = typeof key === 'string';
      const geos = list.map(o => {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(rel(o));
        if (mono && !g.attributes.color) {
          const c = o.material.color, arr = new Float32Array(g.attributes.position.count * 3);
          for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
          g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        }
        return g;
      });
      const mat = mono ? MONO[key] : key;
      const merged = new THREE.Mesh(merge(geos), mat);
      merged.castShadow = cast && !mat.transparent; merged.receiveShadow = receive;
      out.add(merged);
    }
    for (const o of keep) {
      const k = o.clone(); rel(o).decompose(k.position, k.quaternion, k.scale);
      k.castShadow = cast; k.receiveShadow = receive; out.add(k);
    }
    return out;
  }
  function merge(geos) {
    let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
    const out = new THREE.BufferGeometry();
    const hasColor = geos.some(g => g.attributes.color);
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ...(hasColor ? [['color', 3]] : [])]) {
      const arr = new Float32Array(n * size); let off = 0;
      for (const g of geos) {
        const a = g.attributes[name];
        if (a) arr.set(a.array.subarray(0, a.count * size), off);
        else if (name === 'color') arr.fill(1, off, off + g.attributes.position.count * size);
        off += g.attributes.position.count * size;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
  }
  const shadowAll = (g, cast = true) => { g.traverse(o => { if (o.isMesh) { o.castShadow = cast && !(o.material && o.material.transparent); o.receiveShadow = true; } }); return g; };

  // A soft round shadow under moving things, so they sit on the road.
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function blob(w, l) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .015; m.renderOrder = 1;
    return m;
  }

  function wheel(r, w, { spokes = 0, rim = CHROME() } = {}) {
    const g = new THREE.Group();
    const t = mesh(new THREE.TorusGeometry(r - w * .45, w * .5, 10, 24), RUBBER()); t.rotation.y = Math.PI / 2; g.add(t);
    const disc = cyl(r * .62, r * .62, w * .7, rim); disc.rotation.z = Math.PI / 2; g.add(disc);
    const hub = cyl(r * .2, r * .2, w * .95, M('#888', { metalness: .7, roughness: .4 })); hub.rotation.z = Math.PI / 2; g.add(hub);
    for (let i = 0; i < spokes; i++) {
      const s = cyl(.012, .012, r * 1.9, M('#777', { metalness: .6, roughness: .4 }), 0, 0, 0, 5);
      s.rotation.x = i / spokes * Math.PI; g.add(s);
    }
    const b = bake(g); b.userData.spin = true;
    return b;
  }

  // ---------- people ----------
  const SKIN = ['#8d5524', '#a0662f', '#c68642', '#b5774a', '#7a4a26', '#d19a6a', '#6b3f22'];
  const HAIR = ['#151210', '#1d1612', '#2b1d14', '#3a2a1e', '#d9d9d9'];
  const SAREE = ['#d81b60', '#ff6f00', '#8e24aa', '#00897b', '#fdd835', '#c62828', '#1e88e5', '#43a047'];
  const SHIRT = ['#f5f5f0', '#90caf9', '#ef9a9a', '#a5d6a7', '#fff59d', '#ce93d8', '#ffcc80', '#b0bec5', '#5d4037'];
  const PANTS = ['#37474f', '#4e342e', '#263238', '#795548', '#9e9e9e', '#1a237e'];

  // A person about 1.65 units tall, facing -z. Limbs hang from pivots so they can walk.
  function person(o = {}) {
    const woman = o.woman ?? Math.random() < .45;
    const skin = M(o.skin || pick(SKIN), { roughness: .6 });
    const hair = M(o.hair || pick(HAIR.slice(0, woman ? 4 : 5)), { roughness: .8 });
    const outfit = o.outfit || (woman ? pick(['saree', 'saree', 'salwar']) : pick(['shirt', 'shirt', 'kurta', 'kurta']));
    const top = M(o.top || (woman ? pick(SAREE) : outfit === 'kurta' ? pick(['#f5f5f0', '#ffe0b2', '#e1f5fe', '#ffffff', '#fff3e0', '#d7ccc8']) : pick(SHIRT)), { roughness: .85 });
    const bottom = M(o.bottom || (outfit === 'kurta' || outfit === 'salwar' ? '#f2efe6' : pick(PANTS)), { roughness: .85 });
    const g = new THREE.Group(), parts = {};

    const limb = (x, y, r, len, m, footM) => {
      const piv = new THREE.Group(); piv.position.set(x, y, 0);
      piv.add(cap(r, len, m, 0, -len / 2 - r * .5, 0));
      if (footM) piv.add(RB(.1, .07, .23, .03, footM, 0, -len - r - .02, -.04));
      else piv.add(sph(r * 1.05, skin, 0, -len - r * 1.2, 0));
      g.add(piv); return piv;
    };
    const shoe = M(pick(['#3e2723', '#212121', '#795548', '#8d6e63']), { roughness: .6 });
    parts.legL = limb(-.09, .86, .062, .7, outfit === 'saree' ? skin : bottom, shoe);
    parts.legR = limb(.09, .86, .062, .7, outfit === 'saree' ? skin : bottom, shoe);
    // torso
    g.add(sph(.14, outfit === 'saree' ? top : bottom, 0, .9, 0, 1.08, .62, .8));
    const chest = cap(.15, .26, top, 0, 1.2, 0); chest.scale.set(1.12, 1, .74); g.add(chest);
    if (outfit === 'kurta' || outfit === 'salwar') g.add(lathe([[.16, 1.3], [.19, 1.05], [.24, .55], [.0, .55]].reverse(), top, 0, 0, 0));
    if (outfit === 'saree') {
      g.add(lathe([[0, .08], [.27, .08], [.22, .5], [.17, .95], [0, .95]], top, 0, 0, 0));
      const border = M(o.border || pick(['#ffd54f', '#c62828', '#1b5e20', '#4a148c']), { roughness: .6, metalness: .2 });
      g.add(cyl(.272, .272, .07, border, 0, .12, 0, 24));
      const pallu = RB(.17, .62, .03, .012, top, .02, 1.16, -.125); pallu.rotation.z = -.62; g.add(pallu);
      const edge = RB(.04, .62, .032, .01, border, .08, 1.12, -.128); edge.rotation.z = -.62; g.add(edge);
      g.add(RB(.15, .5, .03, .012, top, -.17, 1.15, .1));                    // pallu falling down the back
    }
    if (outfit === 'shirt') { g.add(RB(.3, .05, .22, .02, M('#3e2723'), 0, .99, 0)); } // belt
    // arms
    parts.armL = limb(-.215, 1.37, .05, .44, outfit === 'saree' ? skin : top);
    parts.armR = limb(.215, 1.37, .05, .44, outfit === 'saree' ? skin : top);
    parts.armL.rotation.z = -.08; parts.armR.rotation.z = .08;
    // head
    g.add(cyl(.05, .055, .12, skin, 0, 1.45, 0, 10));
    const head = new THREE.Group(); head.position.set(0, 1.6, 0); g.add(head); parts.head = head;
    head.add(sph(.118, skin, 0, 0, 0, .9, 1.08, .98));
    head.add(sph(.022, skin, 0, -.015, -.112, 1, 1.3, 1, 8));                // nose
    for (const x of [-.04, .04]) {
      head.add(sph(.017, M('#f6f2ea'), x, .02, -.1, 1, .8, .5, 8));
      head.add(sph(.01, M('#1a1410'), x, .02, -.109, 1, 1, .5, 6));
      head.add(RB(.035, .008, .01, .003, M('#1a1410'), x, .048, -.104));  // eyebrow
      head.add(sph(.02, skin, x * 2.65, 0, 0, .5, 1, 1, 8));              // ears
    }
    const hc = mesh(new THREE.SphereGeometry(.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), hair, 0, .02, .02); hc.scale.set(.96, 1.08, 1.06); hc.rotation.x = .7; head.add(hc);
    if (woman) { const back = sph(.11, hair, 0, -.04, .045, .98, 1.1, .9); head.add(back); }
    if (woman) {
      head.add(sph(.06, hair, 0, -.03, .125));                                // bun
      head.add(RB(.006, .02, .006, .002, M('#d32f2f'), 0, .085, -.108)); // sindoor
      head.add(sph(.012, M('#c62828'), 0, .05, -.113, 1, 1, .5, 8));       // bindi
    } else {
      if (Math.random() < .55) head.add(RB(.08, .016, .02, .008, hair, 0, -.048, -.105)); // moustache
      if (o.turban || Math.random() < .12) {
        const tc = M(pick(['#ff6f00', '#d50000', '#ffd600', '#1565c0', '#f5f5f5']), { roughness: .9 });
        head.add(sph(.13, tc, 0, .06, .01, 1, .75, 1.05));
      } else if (o.cap) head.add(sph(.118, M(o.cap), 0, .05, 0, 1, .55, 1.05));
    }
    // bake each moving part, and the body, into single meshes
    const pivots = Object.values(parts);
    for (const pv of pivots) { const b = bake(pv); pv.clear(); b.children.slice().forEach(c => pv.add(c)); }
    const body = new THREE.Group();
    g.children.filter(c => !pivots.includes(c)).forEach(c => body.add(c));
    const bb = bake(body); bb.children.slice().forEach(c => g.add(c));
    g.userData.parts = parts;
    g.userData.phase = Math.random() * 6;
    shadowAll(g);
    return g;
  }
  // swing the limbs; speed 0 stands still
  function animatePerson(p, t, speed) {
    const P = p.userData.parts, s = Math.sin(t * 7 + p.userData.phase) * Math.min(1, speed) * .55;
    P.legL.rotation.x = s; P.legR.rotation.x = -s;
    P.armL.rotation.x = -s * .8; P.armR.rotation.x = s * .8;
    P.head.rotation.y = speed ? 0 : Math.sin(t * .7 + p.userData.phase) * .4;
  }
  function seated(p) {
    const P = p.userData.parts;
    P.legL.rotation.x = P.legR.rotation.x = Math.PI / 2 - .1;
    P.armL.rotation.x = P.armR.rotation.x = Math.PI / 2.6;
    return p;
  }

  // ---------- the auto-rickshaw ----------
  function rickshaw(s) {
    const g = new THREE.Group();
    const body = M(s.body, { roughness: .35, metalness: .15 }), top = M(s.top, { roughness: .6 });
    const dark = M('#26262a', { roughness: .6 });
    // passenger tub, wide and rounded at the back
    g.add(mesh(profile([[-1.0, .26], [.05, .26], [.05, .78], [-.82, .8], [-1.02, .55, -1.02, .74]], 1.18, .06), body));
    // front cowl, narrow, curving down to the nose
    g.add(mesh(profile([[-.05, .26], [1.0, .3], [1.18, .62, 1.2, .38], [.95, .98, 1.12, .9], [.45, 1.0], [.05, .82]], .7, .07), body));
    g.add(RB(.74, .05, .5, .02, CHROME(), 0, .29, -.62));                   // footboard edge
    // canopy: the iconic hood, a curved shell with an open side
    g.add(mesh(profile([[.66, 1.58], [.72, 1.66], [-.62, 1.76, .1, 1.8], [-1.06, 1.08, -1.1, 1.68], [-1.0, 1.08], [-.97, 1.6, -1.02, 1.6], [-.6, 1.7, -.9, 1.7], [.66, 1.58, .05, 1.71]], 1.22, .03), top));
    for (const z of [.15, .55]) g.add(RB(1.25, .025, .05, .01, M(s.trim || '#2a2a2a', { roughness: .7 }), 0, 1.79 - (z - .15) * .03, z)); // hood seams
    const rw = RB(.62, .26, .02, .05, M('#1e2a33', { roughness: .1, metalness: .3 }), 0, 1.42, 1.1); g.add(rw); // rear window
    g.add(RB(1.26, .06, .05, .02, dark, 0, 1.6, -.68));                   // hood front rail
    // windscreen and its frame
    const glass = RB(.62, .52, .02, .01, GLASS(), 0, 1.24, -.58); glass.rotation.x = -.18; glass.userData.keep = true; g.add(glass);
    for (const x of [-.33, .33]) { const p = cyl(.022, .022, .6, dark, x, 1.22, -.58, 8); p.rotation.x = -.18; g.add(p); }
    for (const x of [-.6, .6]) { g.add(cyl(.02, .02, .9, CHROME(), x, 1.2, .02, 8)); g.add(cyl(.02, .02, .8, dark, x, 1.2, .78, 8)); }
    // seats
    g.add(RB(1.0, .16, .5, .06, M('#5a1414', { roughness: .55 }), 0, .82, .45));
    g.add(RB(1.0, .48, .14, .06, M('#5a1414', { roughness: .55 }), 0, 1.1, .74));
    g.add(RB(.38, .12, .34, .05, M('#2a2a2a', { roughness: .6 }), 0, .86, -.22));
    // handlebar, headlamp, mirrors, indicators
    g.add(tube([V(-.34, 1.02, -.42), V(-.2, 1.08, -.5), V(.2, 1.08, -.5), V(.34, 1.02, -.42)], .018, CHROME()));
    for (const x of [-.36, .36]) g.add(rot(cyl(.028, .028, .1, RUBBER(), x, 1.01, -.41, 8), 'z', Math.PI / 2));
    g.add(rot(cyl(.11, .1, .12, CHROME(), 0, .72, -1.17), 'x', Math.PI / 2));
    g.add(rot(cyl(.085, .085, .02, GLOW('#fff6d0'), 0, .72, -1.235), 'x', Math.PI / 2));
    for (const x of [-.27, .27]) g.add(sph(.035, GLOW('#ffab00'), x, .78, -1.1));
    for (const x of [-.4, .4]) { g.add(tube([V(x * .8, 1.1, -.5), V(x, 1.35, -.55)], .008, CHROME(), 4)); g.add(sph(.05, CHROME(), x, 1.38, -.56, 1, 1.2, .3)); }
    // rear: tail lights and number plate
    for (const x of [-.45, .45]) { g.add(RB(.14, .1, .04, .02, GLOW('#ff1a1a'), x, .56, 1.1)); g.add(RB(.07, .1, .04, .02, GLOW('#ffab00'), x * 1.25, .56, 1.09)); }
    g.add(RB(1.1, .08, .06, .03, CHROME(), 0, .34, 1.08)); // rear bumper
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.36, .11), new THREE.MeshStandardMaterial({ map: RT.plate(s.plate || 'MH 01 AR 2024'), roughness: .5 }));
    pl.position.set(0, .5, 1.105); pl.userData.keep = true; g.add(pl);
    // chrome trim and a lucky lemon-chilli charm
    g.add(RB(1.2, .04, .04, .02, CHROME(), 0, .5, .9));
    g.add(sph(.03, M('#c6e03a'), .2, 1.3, -.62)); g.add(cap(.012, .05, M('#2e7d32'), .2, 1.24, -.62));

    // the moving parts stay separate
    const out = bake(g);
    const front = wheel(.24, .12); front.position.set(0, .24, -.95); out.add(front);
    const guard = mesh(new THREE.TorusGeometry(.27, .05, 6, 16, Math.PI), body); guard.rotation.y = Math.PI / 2; guard.position.set(0, .26, -.95); out.add(guard);
    for (const x of [-.6, .6]) { const w = wheel(.25, .14); w.position.set(x, .25, .45); out.add(w); }
    const driver = seated(person({ woman: false, top: '#c8a165', bottom: '#b08d57', outfit: 'shirt', turban: false }));
    driver.scale.setScalar(.82); driver.position.set(0, .22, -.15); out.add(driver);
    shadowAll(out);
    out.userData.wheels = out.children.filter(c => c.userData.spin);
    out.userData.shadow = blob(1.9, 3.1);
    return out;
  }

  // ---------- obstacles ----------
  function cow() {
    const g = new THREE.Group();
    const brown = Math.random() < .3;
    const hide = M(brown ? '#8a5a3c' : '#efe9de', { roughness: .85 }), darker = M(brown ? '#5d3a24' : '#cfc6b6', { roughness: .85 });
    const body = cap(.36, .85, hide, 0, 1.0, 0); body.rotation.z = Math.PI / 2; body.scale.set(1, 1, .82); g.add(body);
    g.add(sph(.3, hide, -.25, 1.05, 0, 1.3, .9, .85));                     // belly
    g.add(sph(.2, darker, .45, 1.38, 0, 1.1, .9, .8));                     // hump
    const neck = cap(.17, .3, hide, .78, 1.22, 0); neck.rotation.z = -1.0; g.add(neck);
    g.add(sph(.18, hide, .7, .95, 0, .5, 1.3, .6));                        // dewlap
    const head = new THREE.Group(); head.position.set(1.0, 1.4, 0); g.add(head);
    const skull = cap(.13, .26, hide, .1, -.05, 0); skull.rotation.z = -1.9; head.add(skull);
    head.add(sph(.11, M('#3b2b25', { roughness: .5 }), .3, -.15, 0, 1, .8, 1.05)); // muzzle
    for (const z of [-1, 1]) {
      head.add(sph(.022, M('#111', { roughness: .2 }), .12, .02, z * .12));
      const ear = sph(.09, darker, -.05, .02, z * .2, 1, .45, 1.4); ear.rotation.x = z * .4; head.add(ear);
      head.add(tube([V(-.02, .1, z * .07), V(-.04, .22, z * .13), V(.02, .32, z * .1)], .022, M(Math.random() < .4 ? '#ff7043' : '#d7c9a7', { roughness: .5 }), 8));
    }
    const legs = [];
    for (const [x, z] of [[-.55, -.18], [-.55, .18], [.5, -.18], [.5, .18]]) {
      const l = new THREE.Group(); l.position.set(x, .8, z);
      l.add(cap(.075, .34, hide, 0, -.22, 0)); l.add(cap(.05, .3, hide, 0, -.55, 0));
      l.add(cyl(.055, .06, .08, M('#2a2018'), 0, -.78, 0, 8));
      g.add(l); legs.push(l);
    }
    const tail = tube([V(-.95, 1.1, 0), V(-1.02, .8, 0), V(-1.0, .45, .03)], .02, hide, 10); g.add(tail);
    g.add(sph(.05, M('#3a2a1e'), -1.0, .42, .03, 1, 1.6, 1));
    // a marigold garland
    for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; g.add(sph(.04, M('#ff9800', { roughness: .9 }), .82 + Math.cos(a) * .02, 1.05 - Math.sin(a) * .12, Math.cos(a) * .18, 1, 1, 1, 8)); }
    const out = shadowAll(g);
    out.userData.head = head;
    out.add(blob(1.3, 2.4));
    out.scale.setScalar(.95);
    out.rotation.y = Math.random() < .5 ? Math.PI / 2 : -Math.PI / 2;    // facing along the road
    return out;
  }

  function bus() {
    const g = new THREE.Group();
    const color = pick(['#c62828', '#1565c0', '#e65100', '#2e7d32']);
    const side = new THREE.MeshStandardMaterial({ map: RT.busSide(color), roughness: .45, metalness: .1 });
    const front = new THREE.MeshStandardMaterial({ map: RT.busFront(color, pick(['DELHI', 'AGRA', 'JAIPUR', 'LUCKNOW', 'PUNE'])), roughness: .4 });
    const plain = M(color, { roughness: .45, metalness: .1 });
    const shell = new THREE.Mesh(rbox(1.62, 1.9, 4.6, .14), [side, side, plain, plain, front, M('#222')]);
    shell.position.y = 1.32; shell.userData.keep = true; g.add(shell);
    g.add(RB(1.66, .28, 4.64, .06, M('#2a2a2a', { roughness: .6 }), 0, .4, 0)); // skirt
    for (const x of [-.6, .6]) g.add(sph(.08, GLOW('#fff8e1'), x, .55, 2.3, 1, 1, .4));
    g.add(RB(1.4, .1, .1, .04, CHROME(), 0, .38, 2.34));
    // roof rack loaded with luggage
    g.add(RB(1.4, .06, 3, .02, M('#555', { metalness: .6, roughness: .4 }), 0, 2.31, .3));
    const cloth = ['#6d4c41', '#1565c0', '#c62828', '#558b2f', '#ef6c00', '#8d6e63'];
    for (let i = 0; i < 6; i++) g.add(RB(rnd(.4, .6), rnd(.25, .45), rnd(.4, .6), .1, M(pick(cloth), { roughness: .95 }), rnd(-.4, .4), 2.5, -.9 + i * .45));
    const out = bake(g);
    for (const z of [-1.5, 1.5]) for (const x of [-.72, .72]) { const w = wheel(.42, .26); w.position.set(x, .42, z); out.add(w); }
    shadowAll(out);
    out.add(blob(2.4, 5.4));
    return out;
  }

  const WOOD = () => { if (!mats.has('wood')) mats.set('wood', new THREE.MeshStandardMaterial({ map: RT.wood(), roughness: .85 })); return mats.get('wood'); };
  function cart() {
    const g = new THREE.Group();
    g.add(RB(1.3, .07, .95, .02, WOOD(), 0, .5, 0));
    for (const z of [-.47, .47]) g.add(RB(1.3, .1, .04, .01, WOOD(), 0, .58, z));
    g.add(tube([V(-.65, .5, -.3), V(-1.05, .55, -.3)], .02, WOOD(), 4)); g.add(tube([V(-.65, .5, .3), V(-1.05, .55, .3)], .02, WOOD(), 4));
    const fruit = [['#ff8f00', .07], ['#f9a825', .06], ['#c62828', .065], ['#7cb342', .07]];
    for (let i = 0; i < 4; i++) {           // fruit stacked in little pyramids
      const [col, r] = fruit[i], m = M(col, { roughness: .45 });
      const cx = -.42 + (i % 2) * .7, cz = i < 2 ? -.2 : .2;
      for (let y = 0; y < 3; y++) for (let a = -2 + y; a <= 2 - y; a++) for (let b = -1 + Math.min(y, 1); b <= 1 - Math.min(y, 1); b++) g.add(sph(r, m, cx + a * r * 1.9, .6 + r + y * r * 1.6, cz + b * r * 1.9, 1, 1, 1, 10));
    }
    for (let i = 0; i < 3; i++) { const b = cap(.03, .16, M('#fdd835', { roughness: .5 }), .45 + i * .05, .78, -.35); b.rotation.z = .5 + i * .2; g.add(b); } // bananas
    g.add(cyl(.015, .015, .5, M('#777'), .55, .85, .35, 6));          // weighing scale
    g.add(RB(.3, .015, .015, .005, M('#999', { metalness: .7 }), .55, 1.1, .35));
    const out = bake(g);
    for (const x of [-.4, .4]) { const w = wheel(.33, .06, { spokes: 8, rim: M('#5d4037') }); w.position.set(x, .33, 0); w.rotation.y = Math.PI / 2; out.add(w); }
    shadowAll(out);
    out.add(blob(2.6, 1.5));
    out.rotation.y = Math.PI / 2;
    return out;
  }

  let barricadeMat;
  function barrier() {
    const g = new THREE.Group();
    barricadeMat = barricadeMat || new THREE.MeshStandardMaterial({ map: RT.barricade(), roughness: .55 });
    g.add(mesh(new THREE.BoxGeometry(1.5, .32, .05), M('#222'), 0, .58, 0));
    g.add(mesh(new THREE.PlaneGeometry(1.5, .32), barricadeMat, 0, .58, .026));
    g.add(rot(mesh(new THREE.PlaneGeometry(1.5, .32), barricadeMat, 0, .58, -.026), 'y', Math.PI));
    const metal = M('#9e9e9e', { metalness: .6, roughness: .4 });
    for (const x of [-.65, .65]) { g.add(cyl(.025, .025, .78, metal, x, .39, 0, 8)); g.add(RB(.1, .03, .5, .01, metal, x, .02, 0)); }
    g.add(rot(cyl(.02, .02, 1.3, metal, 0, .32, 0, 8), 'z', Math.PI / 2));
    g.add(sph(.05, GLOW('#ff3d00'), -.65, .83, 0)); g.add(sph(.05, GLOW('#ff3d00'), .65, .83, 0));
    const out = bake(g); out.add(blob(1.8, .7));
    return out;
  }

  function cone(x, z) {
    const g = new THREE.Group();
    g.add(RB(.34, .04, .34, .02, M('#222'), x, .02, z));
    g.add(cyl(.03, .15, .5, M('#ff5a00', { roughness: .5 }), x, .29, z));
    g.add(cyl(.075, .1, .08, M('#f5f5f5', { roughness: .3 }), x, .32, z));
    return g;
  }
  function pothole() {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.CircleGeometry(.62, 24), M('#2c2620', { roughness: 1 }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = .012; hole.scale.set(1.25, 1, 1);
    const p = hole.geometry.attributes.position; for (let i = 1; i < p.count; i++) { const k = .85 + Math.random() * .3; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
    g.add(hole);
    const water = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), M('#56708a', { roughness: .05, metalness: .5 }));
    water.rotation.x = -Math.PI / 2; water.position.y = .02; water.scale.set(1.25, 1, 1); g.add(water);
    for (let i = 0; i < 10; i++) { const a = Math.random() * 7; g.add(RB(.08, .05, .1, .02, M('#5a5a5e'), Math.cos(a) * .8, .03, Math.sin(a) * .65)); }
    for (let i = 0; i < 3; i++) g.add(cone(-.55 + i * .55, -.75));
    return bake(g);
  }

  // ---------- pickups ----------
  let coinMat, coinGeo;
  function coin() {
    if (!coinMat) {
      coinMat = new THREE.MeshStandardMaterial({ map: RT.coinFace(), roughness: .3, metalness: .35, emissive: '#7a5200', emissiveIntensity: .35 });
      coinGeo = new THREE.CylinderGeometry(.27, .27, .06, 28);
    }
    const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2;
    const g = new THREE.Group(); g.add(c); g.userData.spinner = c;
    return g;
  }
  function power(type, color) {
    const g = new THREE.Group();
    const m = M(color, { roughness: .3, metalness: .4, emissive: color, emissiveIntensity: .25 });
    if (type === 'magnet') {
      const t = mesh(new THREE.TorusGeometry(.26, .09, 12, 24, Math.PI), m, 0, .95, 0); t.rotation.z = Math.PI; g.add(t);
      for (const x of [-.26, .26]) g.add(cyl(.09, .09, .14, CHROME(), x, .82, 0));
    } else if (type === 'nitro') {
      g.add(cap(.15, .4, m, 0, .95, 0));
      g.add(cyl(.06, .08, .1, CHROME(), 0, 1.3, 0));
      g.add(sph(.09, GLOW('#ffffff'), 0, .95, -.15, 1, 1, .3));
    } else if (type === 'double') {
      for (let i = 0; i < 3; i++) { const c = coin(); c.position.set(0, .7 + i * .16, 0); c.rotation.x = Math.PI / 2; g.add(c); }
    } else {
      const p = person({ woman: Math.random() < .5 }); p.scale.setScalar(.75); p.userData.parts.armR.rotation.z = 2.6; g.add(p);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .03, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8 }));
    ring.position.y = .95; g.add(ring); g.userData.ring = ring;
    const halo = new THREE.Mesh(new THREE.CircleGeometry(.6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .25, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = .02; g.add(halo);
    return g;
  }

  // ---------- the street ----------
  const facades = [];
  function building() {
    if (facades.length < 14) facades.push(RT.facade(1 + Math.floor(Math.random() * 3), 2 + Math.floor(Math.random() * 2)));
    const f = pick(facades), d = rnd(2.6, 3.4);
    const wall = M(f.base, { roughness: .9 });
    const front = new THREE.MeshStandardMaterial({ map: f.map, roughness: .85 });
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(f.w, f.h, d), wall, 0, f.h / 2, 0));
    g.add(mesh(new THREE.PlaneGeometry(f.w, f.h), front, 0, f.h / 2, d / 2 + .004));
    const fz = d / 2;
    const floors = Math.round((f.h - 2.55) / 1.3), cols = Math.round((f.w - .5) / 1.15);
    // shop awning
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(f.w - .2, .9, 1, 4), new THREE.MeshStandardMaterial({ map: RT.stripes(pick(['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a']), '#f5f0e6', 8, false), side: THREE.DoubleSide, roughness: .9 }));
    aw.rotation.x = -1.0; aw.position.set(0, 1.2, fz + .38); aw.userData.keep = true; g.add(aw);
    // balconies with railings on some floors
    const rail = M(pick(['#2b2b2b', '#1b5e20', '#0d47a1', '#4e342e']), { roughness: .5, metalness: .3 });
    for (let k = 0; k < floors; k++) {
      if (Math.random() < .45) continue;
      const y = 2.2 + k * 1.3 + .02, bw = f.w * rnd(.5, .85);
      g.add(RB(bw, .1, .6, .02, M('#d6d0c4', { roughness: .9 }), 0, y, fz + .3));
      g.add(rot(cyl(.02, .02, bw, rail, 0, y + .55, fz + .58, 6), 'z', Math.PI / 2));
      for (let x = -bw / 2 + .05; x <= bw / 2; x += .12) g.add(cyl(.01, .01, .5, rail, x, y + .3, fz + .58, 4));
      if (Math.random() < .5) for (let i = 0; i < 3; i++) g.add(RB(.25, .4, .01, .005, M(pick(SAREE), { roughness: 1 }), -bw / 3 + i * .3, y + .35, fz + .6)); // laundry
      if (Math.random() < .4) { g.add(cyl(.09, .07, .16, M('#a1502a'), bw / 2 - .15, y + .13, fz + .4, 10)); g.add(sph(.14, M('#3f8f3a', { roughness: .9 }), bw / 2 - .15, y + .3, fz + .4)); }
    }
    // AC units and a DTH dish
    if (Math.random() < .6) { const y = 2.6 + Math.floor(Math.random() * Math.max(1, floors)) * 1.3; g.add(RB(.5, .38, .25, .03, M('#ecebe6', { roughness: .5 }), f.w / 2 - .45, y, fz + .14)); g.add(rot(cyl(.13, .13, .02, M('#555'), f.w / 2 - .45, y, fz + .27, 14), 'x', Math.PI / 2)); }
    if (Math.random() < .6) { const dsh = mesh(new THREE.SphereGeometry(.22, 14, 8, 0, Math.PI * 2, 0, 1.0), M('#e0e0e0', { side: THREE.DoubleSide, roughness: .4 }), -f.w / 2 + .35, f.h + .1, fz - .3); dsh.rotation.x = -1.9; g.add(dsh); }
    // roof: water tank (black, ribbed), stair room, parapet
    if (Math.random() < .8) { const tx = rnd(-f.w / 4, f.w / 4); g.add(lathe([[0, 0], [.36, 0], [.38, .1], [.36, .2], [.38, .3], [.36, .4], [.38, .5], [.34, .62], [.1, .7], [.1, .76], [0, .76]], M('#1c1c1c', { roughness: .6 }), tx, f.h, -d / 4)); }
    if (Math.random() < .5) g.add(RB(1.1, 1.0, 1.1, .02, wall, -f.w / 4, f.h + .5, -d / 4 + .3));
    // electricity meter box and a tangle of wires
    g.add(RB(.3, .4, .12, .02, M('#9e9e9e', { roughness: .5 }), -f.w / 2 + .3, 1.65, fz + .06));
    const out = bake(g, { cast: true });
    out.userData.w = f.w; out.userData.d = d;
    return out;
  }

  // Leafy roadside tree (neem/peepal) with the white-and-red painted trunk.
  function foliage(r, colA, colB) {
    const geo = new THREE.IcosahedronGeometry(r, 2), p = geo.attributes.position;
    const col = new Float32Array(p.count * 3), a = new THREE.Color(colA), b = new THREE.Color(colB), c = new THREE.Color(), n = V(0, 0, 0);
    const seed = Math.random() * 10;
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      const bump = 1 + .14 * Math.sin(n.x * 9 + seed) * Math.sin(n.y * 8 + seed * 2) * Math.sin(n.z * 10 + seed * 3) + .03 * Math.sin(n.x * 11 + n.y * 9 + n.z * 10);
      p.setXYZ(i, n.x * r * bump, n.y * r * bump * .85, n.z * r * bump);
      c.copy(a).lerp(b, THREE.MathUtils.clamp(.5 + n.y * .5 + (Math.sin(i * 12.9898) * .15), 0, 1));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const nm = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(p, i).normalize(); nm.setXYZ(i, n.x, n.y, n.z); } // soft, rounded shading
    return geo;
  }
  const LEAF = () => M('#ffffff', { vertexColors: true, roughness: .9 });
  function tree() {
    const g = new THREE.Group(), bark = M('#6b4a32', { roughness: .95 });
    const h = rnd(2.2, 3), lean = rnd(-.25, .25);
    g.add(tube([V(0, 0, 0), V(lean * .3, h * .4, 0), V(lean, h, 0)], .14, bark, 10));
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(0, 1); g.add(tube([V(lean * .6, h * .7, 0), V(Math.cos(a) * .7 + lean, h + .3, Math.sin(a) * .7)], .06, bark, 6)); }
    g.add(cyl(.17, .17, .4, M('#f4f1ea', { roughness: .8 }), 0, .2, 0)); g.add(cyl(.165, .165, .3, M('#c62828', { roughness: .8 }), 0, .55, 0)); g.add(cyl(.16, .16, .25, M('#f4f1ea', { roughness: .8 }), lean * .07, .82, 0));
    const blobs = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blobs; i++) {
      const a = i / blobs * Math.PI * 2, r = rnd(.7, 1.0);
      g.add(mesh(foliage(r, '#2f5d1f', pick(['#7fb24a', '#8cc152', '#6fa83d'])), LEAF(), lean + Math.cos(a) * .7, h + .35 + rnd(-.2, .4), Math.sin(a) * .7));
    }
    g.add(mesh(foliage(1.1, '#2f5d1f', '#86bd4e'), LEAF(), lean, h + .9, 0));
    return bake(g);
  }

  let frondMat;
  function palm() {
    frondMat = frondMat || new THREE.MeshStandardMaterial({ map: RT.frond(), alphaTest: .4, side: THREE.DoubleSide, roughness: .8 });
    const g = new THREE.Group(), h = rnd(4.5, 6), bend = rnd(.3, .8);
    for (let i = 0; i < 14; i++) {
      const t = i / 14, y = t * h;
      g.add(cyl(.15 - t * .04, .16 - t * .04, h / 14 + .02, M(i % 2 ? '#8a7356' : '#7a6448', { roughness: 1 }), bend * t * t, y + h / 28, 0, 10));
    }
    for (let i = 0; i < 9; i++) {
      const geo = new THREE.PlaneGeometry(.7, 2.4, 1, 8), p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 1.2; p.setZ(k, -.12 * y * y); }
      geo.translate(0, 1.2, 0);
      const f = mesh(geo, frondMat, bend, h, 0);
      f.rotation.set(rnd(.9, 1.4), i / 9 * Math.PI * 2, 0, 'YXZ');
      g.add(f);
    }
    for (let i = 0; i < 4; i++) g.add(sph(.08, M('#5d4520'), bend + Math.cos(i * 1.6) * .12, h - .1, Math.sin(i * 1.6) * .12));
    return bake(g);
  }

  function lamp() {
    const g = new THREE.Group(), metal = M('#6b7075', { roughness: .4, metalness: .6 });
    g.add(cyl(.06, .09, 4.2, metal, 0, 2.1, 0, 10));
    g.add(tube([V(0, 4.1, 0), V(.3, 4.45, 0), V(1.2, 4.5, 0)], .035, metal, 12));
    g.add(RB(.5, .1, .22, .04, metal, 1.25, 4.45, 0));
    g.add(RB(.42, .03, .16, .015, GLOW('#fff3c4'), 1.25, 4.39, 0));
    g.add(RB(.2, .4, .14, .02, M('#4a4a4a'), 0, 1.4, .1));
    return bake(g);
  }

  // Concrete electric pole; `wire` adds the drooping cables to the next pole.
  function pole(span) {
    const g = new THREE.Group(), conc = M('#a8a49c', { roughness: .95 });
    g.add(RB(.18, 6, .18, .03, conc, 0, 3, 0));
    g.add(RB(1.4, .1, .1, .02, conc, 0, 5.6, 0));
    for (const x of [-.6, -.2, .2, .6]) g.add(cyl(.035, .045, .14, M('#f0ede4', { roughness: .4 }), x, 5.72, 0, 8));
    if (Math.random() < .3) { g.add(RB(.5, .7, .4, .04, M('#7d8278', { roughness: .6, metalness: .3 }), 0, 4.3, .3)); }
    const wire = M('#151515', { roughness: .8 });
    for (const x of [-.6, -.2, .2, .6]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V(x, 5.78 - Math.sin(t * Math.PI) * .7, -t * span)); }
      g.add(tube(pts, .012, wire, 16));
    }
    return bake(g, { cast: false });
  }

  // Shrine by the road: shikhara tower, kalash and a saffron flag.
  function shrine() {
    const g = new THREE.Group(), white = M('#f6f0e4', { roughness: .8 }), saffron = M('#f57c00', { roughness: .7 });
    g.add(RB(2.6, .35, 2.6, .04, M('#bdb5a6'), 0, .17, 0));
    g.add(RB(2.0, 1.7, 2.0, .05, white, 0, 1.2, 0));
    g.add(RB(.8, 1.2, .1, .3, M('#3b2a20'), 0, .95, 1.0));
    for (const x of [-.75, .75]) g.add(cyl(.09, .1, 1.7, saffron, x, 1.2, 1.05, 12));
    g.add(lathe([[0, 0], [1.05, 0], [1.0, .5], [.85, 1.2], [.6, 1.8], [.35, 2.2], [.15, 2.4], [0, 2.45]], saffron, 0, 2.05, 0, 8));
    g.add(lathe([[0, 0], [.18, 0], [.2, .12], [.1, .22], [.14, .3], [0, .42]], M('#d4a017', { roughness: .3, metalness: .8 }), 0, 4.45, 0));
    g.add(cyl(.02, .02, 1.4, M('#5d4037'), .5, 4.4, 0, 6));
    const flag = mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(.7, .2), new THREE.Vector2(0, .45)])), M('#ff6d00', { side: THREE.DoubleSide, roughness: .9 }), .5, 4.7, 0);
    g.add(flag);
    for (let i = 0; i < 14; i++) { const a = i / 13; g.add(sph(.05, M(i % 2 ? '#ff9800' : '#ffd54f', { roughness: .9 }), -.75 + a * 1.5, 1.95 - Math.sin(a * Math.PI) * .25, 1.06, 1, 1, 1, 8)); }
    return bake(g);
  }

  // A string of festival flags across the street.
  function bunting() {
    const g = new THREE.Group(), cols = ['#ff9933', '#ffffff', '#138808', '#ffd400', '#e91e63', '#ff9933'];
    const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(V(-5 + t * 10, 5.2 - Math.sin(t * Math.PI) * .8, 0)); }
    g.add(tube(pts, .01, M('#333'), 30));
    for (let i = 1; i < 30; i++) {
      const p = pts[i], tri = new THREE.Shape([new THREE.Vector2(-.14, 0), new THREE.Vector2(.14, 0), new THREE.Vector2(0, -.32)]);
      const f = mesh(new THREE.ShapeGeometry(tri), M(cols[i % cols.length], { side: THREE.DoubleSide, roughness: .9 }), p.x, p.y, 0);
      f.rotation.x = rnd(-.2, .2); g.add(f);
    }
    return bake(g, { cast: false });
  }

  // Mobile phone tower in the distance, painted red and white.
  function tower() {
    const g = new THREE.Group(), red = M('#d32f2f', { roughness: .6, metalness: .3 }), white = M('#eeeeee', { roughness: .6, metalness: .3 });
    const H = 22, leg = (t) => 1.6 * (1 - t) + .35;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(tube([V(sx * leg(0), 0, sz * leg(0)), V(sx * leg(1), H, sz * leg(1))], .06, white, 2));
    for (let i = 0; i < 11; i++) {
      const t0 = i / 11, t1 = (i + 1) / 11, m = i % 2 ? red : white;
      for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        g.add(tube([V(ax * leg(t0), t0 * H, az * leg(t0)), V(bx * leg(t1), t1 * H, bz * leg(t1))], .03, m, 2));
        g.add(tube([V(ax * leg(t1), t1 * H, az * leg(t1)), V(bx * leg(t1), t1 * H, bz * leg(t1))], .03, m, 2));
      }
    }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const p = RB(.3, 1.2, .12, .04, white, Math.cos(a) * .6, H - .6, Math.sin(a) * .6); p.rotation.y = -a; g.add(p); }
    g.add(sph(.12, GLOW('#ff1744'), 0, H + .3, 0));
    return bake(g, { cast: false });
  }

  function cloud() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, emissive: '#dfe8f2', emissiveIntensity: .45 });
    for (let i = 0; i < 6; i++) g.add(sph(rnd(2, 3.5), m, rnd(-5, 5), rnd(0, 1.5), rnd(-2, 2), 1.3, .7, 1));
    return bake(g, { cast: false, receive: false });
  }

  // Parked two-wheeler: very common on Indian streets.
  function scooter() {
    const g = new THREE.Group(), paint = M(pick(['#c62828', '#212121', '#1565c0', '#eeeeee', '#2e7d32']), { roughness: .3, metalness: .2 });
    g.add(RB(.28, .45, .7, .1, paint, 0, .55, .15));
    g.add(RB(.3, .1, .55, .05, M('#222'), 0, .82, .12));
    g.add(RB(.26, .55, .14, .06, paint, 0, .65, -.42));
    g.add(tube([V(-.25, 1.1, -.45), V(.25, 1.1, -.45)], .018, CHROME(), 3));
    g.add(sph(.06, GLOW('#fff8e1'), 0, 1.0, -.52));
    const out = bake(g);
    for (const z of [-.45, .5]) { const w = wheel(.2, .09); w.position.set(0, .2, z); out.add(w); }
    return shadowAll(out);
  }

  return { M, rbox, bake, rickshaw, person, animatePerson, cow, bus, cart, barrier, pothole, coin, power, building, tree, palm, lamp, pole, shrine, bunting, tower, cloud, scooter, blob };
})();
