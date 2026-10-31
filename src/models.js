// RAJNEETI 3D — detailed models for the town, built in code with the shared art
// kit (art/models.js). Models are made in metres and shrunk so 7 m = one tile.
// Static parts are baked into a few meshes; flags, crowds, cranes and lights
// animate through each model's userData.tick(time).

const Models = (() => {
  const { M, rbox, bake, kit } = RM;
  const { mesh, rot, RB, cyl, sph, cap, tube, lathe, wheel, GLOW, GLASS, CHROME, V } = kit;
  const { canvas, tex, grain, shade, pick, rnd } = RT;
  const TILE = 7;
  const DEVA = '"Noto Sans Devanagari", "Mangal", sans-serif', SANS = '"Arial Black", Arial, sans-serif';

  const CREAM = '#f3e9d6', SAND = '#e3cfa8', STONE = '#cbbfa8', WHITE = '#fbfaf6', WOODC = '#8a5a34', DARK = '#2f3138', GOLD = '#d4a017';
  const tint = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
  const mixW = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();
  const sym = () => (typeof S !== 'undefined' && S && S.symbol) || '★';

  // ---------- painted textures ----------
  const cache = new Map();
  const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // party flag: party colour with the symbol in a white disc
  const flagTex = (color, mark = sym()) => once('flag' + color + mark, () => {
    const [c, g] = canvas(192, 128);
    g.fillStyle = color; g.fillRect(0, 0, 192, 128);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, 192, 10); g.fillRect(0, 118, 192, 10);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(96, 64, 38, 0, 7); g.fill();
    g.font = '54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mark, 96, 68);
    return tex(c);
  });
  // a wall with rows of windows (classical arches or plain)
  const wallTex = (base, cols, floors, arched, frame = '#ffffff') => once(`wall${base}${cols}${floors}${arched}${frame}`, () => {
    const W = cols * 64, H = floors * 96, [c, g] = canvas(W, H);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let f = 0; f < floors; f++) {
      g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, f * 96 + 90, W, 6);
      for (let i = 0; i < cols; i++) {
        const x = i * 64 + 16, y = f * 96 + 22, w = 32, h = 52;
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - 4, y - 2, w + 8, h + 8);
        g.fillStyle = frame;
        g.beginPath(); if (arched) { g.moveTo(x - 3, y + h + 3); g.lineTo(x - 3, y + 14); g.arc(x + w / 2, y + 14, w / 2 + 3, Math.PI, 0); g.lineTo(x + w + 3, y + h + 3); } else g.rect(x - 3, y - 3, w + 6, h + 6); g.fill();
        const gl = g.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, '#a9cbe2'); gl.addColorStop(.5, '#4b6a84'); gl.addColorStop(1, '#2a3a4a');
        g.fillStyle = gl;
        g.beginPath(); if (arched) { g.moveTo(x, y + h); g.lineTo(x, y + 14); g.arc(x + w / 2, y + 14, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h); g.fill();
        g.fillStyle = frame; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h * .55, w, 3);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 3, y + 16, 5, h - 20);
        if (Math.random() < .4) { g.fillStyle = pick(['#c62828', '#f9a825', '#2e7d32', '#eeeeee']); g.globalAlpha = .7; g.fillRect(x, y + 14, w * .35, h - 14); g.globalAlpha = 1; }
        const sg = g.createLinearGradient(0, y + h, 0, y + h + 30); sg.addColorStop(0, 'rgba(70,60,45,.18)'); sg.addColorStop(1, 'rgba(70,60,45,0)');
        g.fillStyle = sg; g.fillRect(x + 4, y + h + 6, 10, 30);
      }
    }
    grain(g, W, H, .1, W * H / 25);
    return tex(c);
  });
  const brickTex = () => once('brick', () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#c8b9a6'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 5; x++) {
      g.fillStyle = pick(['#a4472e', '#b45535', '#9a3f29', '#b9603e', '#8f3a24']);
      g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 8 + 1, 30, 6);
    }
    grain(g, 128, 128, .15, 3000);
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  });
  const tinTex = () => once('tin', () => {
    const [c, g] = canvas(64, 64);
    for (let x = 0; x < 64; x++) { const v = 150 + Math.sin(x / 64 * Math.PI * 8) * 45; g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(x, 0, 1, 64); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(150,80,30,${rnd(.1, .35)})`; g.fillRect(rnd(0, 64), rnd(0, 64), rnd(3, 12), rnd(2, 8)); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
  });
  // signboard text, Hindi over English
  const signTex = (hi, en, bg, fg = '#ffffff') => once('sign' + hi + en + bg, () => {
    const [c, g] = canvas(256, 96);
    const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, shade(bg, 1.15)); gr.addColorStop(1, shade(bg, .8));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (t, font, size, y) => { g.font = `bold ${size}px ${font}`; const s = Math.min(1, 230 / g.measureText(t).width); g.save(); g.translate(128, y); g.scale(s, 1); g.fillText(t, 0, 0); g.restore(); };
    fit(hi, DEVA, 38, 36); fit(en, SANS, 20, 74);
    return tex(c);
  });
  // campaign poster / rally backdrop with the leader's name and symbol
  const posterTex = (color, big) => once('poster' + color + big + sym(), () => {
    const W = big ? 512 : 128, H = big ? 192 : 160, [c, g] = canvas(W, H);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, color); gr.addColorStop(1, shade(color, .65));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff9933'; g.fillRect(0, 0, W, H * .08); g.fillStyle = '#138808'; g.fillRect(0, H * .92, W, H * .08);
    const leader = (typeof S !== 'undefined' && S && S.leader) || 'Neta Ji';
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (big) {
      g.beginPath(); g.arc(90, H / 2, 62, 0, 7); g.fill();
      g.font = '80px sans-serif'; g.fillText(sym(), 90, H / 2 + 6);
      g.font = `bold 46px ${SANS}`; const s = Math.min(1, 360 / g.measureText(leader.toUpperCase()).width);
      g.save(); g.translate(330, 72); g.scale(s, 1); g.fillText(leader.toUpperCase(), 0, 0); g.restore();
      g.font = `bold 34px ${DEVA}`; g.fillText('ज़िंदाबाद!', 330, 130);
    } else {
      g.beginPath(); g.arc(64, 58, 34, 0, 7); g.fill();
      g.font = '42px sans-serif'; g.fillText(sym(), 64, 62);
      g.font = `bold 18px ${SANS}`; g.fillText('VOTE', 64, 112); g.font = `bold 16px ${DEVA}`; g.fillText('वोट दें', 64, 136);
    }
    grain(g, W, H, .1, W * H / 40);
    return tex(c);
  });
  const stripeTex = (a, b) => once('st' + a + b, () => RT.stripes(a, b, 8, false));
  const texMat = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t, roughness: .8, ...o });
  const plane = (w, h, mat, x, y, z) => mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z);

  // ---------- reusable pieces ----------
  // a flag of cloth that ripples in the wind (kept out of baking)
  function clothFlag(w, h, color, mark) {
    const geo = new THREE.PlaneGeometry(w, h, 12, 4); geo.translate(w / 2, 0, 0);
    const f = new THREE.Mesh(geo, texMat(flagTex(color, mark), { side: THREE.DoubleSide, roughness: .9 }));
    f.userData.keep = true; f.userData.cloth = { w, base: geo.attributes.position.array.slice() };
    return f;
  }
  function waveCloth(f, t) {
    const c = f.userData.cloth, p = f.geometry.attributes.position, a = p.array;
    for (let i = 0; i < p.count; i++) {
      const x = c.base[i * 3], k = x / c.w;
      a[i * 3 + 2] = Math.sin(x * 2.2 - t * 6 + c.base[i * 3 + 1]) * .25 * k;
      a[i * 3 + 1] = c.base[i * 3 + 1] - k * k * .15;
    }
    p.needsUpdate = true; f.geometry.computeVertexNormals();
  }
  function flagPole(g, x, z, h, color, w = 2.4, mark) {
    g.add(cyl(.07, .1, h, M('#d8dadf', { metalness: .7, roughness: .35 }), x, h / 2, z, 10));
    g.add(sph(.14, M(GOLD, { metalness: .8, roughness: .3 }), x, h + .1, z));
    const f = clothFlag(w, w * .66, color, mark); f.position.set(x + .07, h - w * .33 - .1, z);
    g.add(f); return f;
  }
  function column(h, r, m) {
    return lathe([[0, 0], [r * 1.5, 0], [r * 1.5, .25], [r * 1.15, .35], [r, .5], [r * .9, h - .5], [r * 1.15, h - .35], [r * 1.5, h - .25], [r * 1.5, h], [0, h]], m, 0, 0, 0, 14);
  }
  function steps(g, w, n, x, z, m, depth = .45) {
    for (let i = 0; i < n; i++) g.add(RB(w, .18, depth * (n - i), .02, m, x, .09 + i * .18, z + depth * i / 2));
  }
  function pediment(w, h, d, m) {
    const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 });
    geo.translate(0, 0, -d / 2); return mesh(geo, m);
  }
  function dome(r, m, x, y, z) { return mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z); }
  // Indo-Saracenic chhatri: four pillars and a little dome
  function chhatri(g, x, y, z, s, m, domeM) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(cyl(.07 * s, .07 * s, 1.1 * s, m, x + a * .4 * s, y + .55 * s, z + b * .4 * s, 8));
    g.add(RB(1.05 * s, .12 * s, 1.05 * s, .03, m, x, y + 1.16 * s, z));
    g.add(dome(.48 * s, domeM, x, y + 1.22 * s, z));
    g.add(lathe([[0, 0], [.06, 0], [.04, .25], [0, .35]], M(GOLD, { metalness: .8, roughness: .3 }), x, y + 1.7 * s, z, 8));
  }
  function waterTank(g, x, y, z) {
    g.add(lathe([[0, 0], [.6, 0], [.63, .2], [.6, .4], [.63, .6], [.6, .8], [.56, 1], [.15, 1.12], [.15, 1.2], [0, 1.2]], M('#1c1c1c', { roughness: .6 }), x, y, z, 16));
  }
  function laundry(g, x, y, z, w) {
    g.add(tube([V(x - w / 2, y, z), V(x, y - .1, z), V(x + w / 2, y, z)], .015, M('#333'), 6));
    for (let i = 0; i < 4; i++) g.add(RB(.35, rnd(.4, .7), .02, .01, M(pick(['#d81b60', '#1e88e5', '#fdd835', '#43a047', '#ffffff', '#ff7043']), { roughness: 1 }), x - w / 2 + .3 + i * (w - .6) / 3, y - .35, z));
  }
  function loudspeaker(g, x, y, z, ry) {
    const hrn = new THREE.Group();
    hrn.add(rot(lathe([[.05, 0], [.12, .1], [.35, .6], [.42, .65], [0, .65]], M('#9ea3a8', { metalness: .6, roughness: .4 }), 0, 0, 0, 16), 'x', Math.PI / 2));
    hrn.position.set(x, y, z); hrn.rotation.set(-.15, ry, 0); g.add(hrn);
  }
  // a crowd baked into a few meshes so it stays cheap; each row bobs
  function crowd(rows, cols, sx, sz, color) {
    const groups = [];
    for (let r = 0; r < rows; r++) {
      const row = new THREE.Group();
      for (let c = 0; c < cols; c++) {
        const p = RM.person({ top: Math.random() < .35 ? color : undefined });
        p.position.set((c - (cols - 1) / 2) * sx + rnd(-.2, .2) + (r % 2) * sx / 2, 0, r * sz + rnd(-.15, .15));
        p.rotation.y = rnd(-.3, .3);
        if (Math.random() < .4) { p.userData.parts.armR.rotation.x = Math.PI - .3; p.userData.parts.armR.rotation.z = .2; } // cheering
        row.add(p);
      }
      const b = bake(row); b.userData.phase = r * 1.3; groups.push(b);
    }
    return groups;
  }
  // move fluttering flags out of the part that gets baked
  function pullCloth(g, anim) { g.children.filter(c => c.userData.cloth).forEach(c => { g.remove(c); anim.push(c); }); }
  // put metre-scale parts on a tile-scale model
  function finish(g, animated = [], ticks = []) {
    const inner = bake(g);
    animated.forEach(a => inner.add(a));
    inner.traverse(o => { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = true; } });
    inner.scale.setScalar(1 / TILE);
    const out = new THREE.Group(); out.add(inner);
    out.userData.tick = (t, dt) => {
      inner.traverse(o => { if (o.userData.cloth) waveCloth(o, t); });
      ticks.forEach(f => f(t, dt));
    };
    return out;
  }

  // ---------- buildings ----------
  const builders = {
    // Party Office: an Indo-Saracenic government building with a dome, chhatris and portico
    hq(level, color) {
      const g = new THREE.Group(), floors = Math.min(4, 1 + Math.floor(level / 1.5)), anim = [];
      const stone = M(STONE, { roughness: .9 }), white = M(WHITE, { roughness: .6 }), band = M(color, { roughness: .5 });
      g.add(RB(13.4, .6, 13.4, .1, stone, 0, .3, 0));
      // lawn with hedges and a path
      g.add(RB(12.6, .08, 12.6, .02, M('#5f9e45', { roughness: 1 }), 0, .64, 0));
      g.add(RB(2.6, .1, 4, .02, M('#d9c9a8'), 0, .66, 4.4));
      for (const s of [-1, 1]) { g.add(RB(4, .7, .7, .3, M('#3f7f32', { roughness: 1 }), s * 3.6, 1.0, 5.8)); }
      const W = 10, D = 7, FH = 3.2, base = .68;
      const wall = texMat(wallTex(CREAM, 6, floors, true, '#ffffff'), { roughness: .85 });
      const side = texMat(wallTex(CREAM, 4, floors, true, '#ffffff'), { roughness: .85 });
      g.add(mesh(new THREE.BoxGeometry(W, FH * floors, D), M(CREAM, { roughness: .9 }), 0, base + FH * floors / 2, -1));
      g.add(plane(W, FH * floors, wall, 0, base + FH * floors / 2, -1 + D / 2 + .01));
      g.add(rot(plane(W, FH * floors, wall, 0, base + FH * floors / 2, -1 - D / 2 - .01), 'y', Math.PI));
      g.add(rot(plane(D, FH * floors, side, W / 2 + .01, base + FH * floors / 2, -1), 'y', Math.PI / 2));
      g.add(rot(plane(D, FH * floors, side, -W / 2 - .01, base + FH * floors / 2, -1), 'y', -Math.PI / 2));
      for (let f = 1; f <= floors; f++) g.add(RB(W + .4, .22, D + .4, .05, f === floors ? white : band, 0, base + FH * f, -1)); // cornice bands
      const top = base + FH * floors + .1;
      // parapet, chhatris and the central dome
      g.add(RB(W + .2, .5, .25, .05, white, 0, top + .25, -1 + D / 2)); g.add(RB(W + .2, .5, .25, .05, white, 0, top + .25, -1 - D / 2));
      for (const [x, z] of [[-W / 2 + .5, -1 + D / 2 - .5], [W / 2 - .5, -1 + D / 2 - .5], [-W / 2 + .5, -1 - D / 2 + .5], [W / 2 - .5, -1 - D / 2 + .5]]) chhatri(g, x, top, z, 1, white, M(mixW(color, .55), { roughness: .5 }));
      g.add(cyl(2.1, 2.2, 1.4, white, 0, top + .7, -1, 24));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(cyl(.12, .12, 1.4, M(CREAM), Math.cos(a) * 2.2, top + .7, -1 + Math.sin(a) * 2.2, 8)); }
      g.add(RB(4.6, .2, 4.6, .1, band, 0, top + 1.5, -1));
      g.add(lathe([[0, 0], [2.1, 0], [2.05, .6], [1.8, 1.4], [1.3, 2.1], [.6, 2.6], [.2, 2.8], [0, 2.85]], M(mixW(color, .35), { roughness: .45, metalness: .1 }), 0, top + 1.6, -1, 28));
      g.add(lathe([[0, 0], [.18, 0], [.2, .2], [.08, .4], [.12, .55], [0, .9]], M(GOLD, { metalness: .85, roughness: .25 }), 0, top + 4.4, -1, 10));
      // portico: steps, columns, pediment with the party symbol
      steps(g, 6, 3, 0, 3.6, stone);
      for (let i = 0; i < 6; i++) { const c = column(3.4, .2, white); c.position.set(-2.5 + i, base, 3.1); g.add(c); }
      g.add(RB(6.2, .45, 1.5, .05, white, 0, base + 3.6, 2.9));
      const ped = pediment(6.2, 1.3, 1.4, white); ped.position.set(0, base + 3.82, 2.9); g.add(ped);
      g.add(rot(cyl(.45, .45, .08, band, 0, base + 4.3, 3.62, 24), 'x', Math.PI / 2));
      g.add(RB(1.4, 2.4, .1, .05, M('#5d3a1e', { roughness: .6 }), 0, base + 1.2, 2.55));      // main door
      g.add(plane(3.4, 1, texMat(signTex('पार्टी कार्यालय', 'PARTY OFFICE', color)), 0, base + 2.85, 2.56));
      // flag on the dome and in the garden
      flagPole(g, 5.6, 4.6, 7.5, color, 2.6); pullCloth(g, anim);
      if (level >= 3) for (const s of [-1, 1]) { // side wings
        g.add(mesh(new THREE.BoxGeometry(1.6, FH, 5), M(CREAM), s * 5.9, base + FH / 2, -1.5));
        g.add(rot(plane(5, FH, side, s * 6.71, base + FH / 2, -1.5), 'y', s * Math.PI / 2));
        g.add(RB(1.8, .2, 5.2, .05, band, s * 5.9, base + FH, -1.5));
      }
      // volunteers at the door
      const ppl = [RM.person({ top: color }), RM.person({ top: '#ffffff', outfit: 'kurta' })];
      ppl[0].position.set(-1.6, base, 4.4); ppl[1].position.set(1.5, base, 4.6); ppl.forEach(p => { p.rotation.y = Math.PI + rnd(-.5, .5); g.add(p); });
      return finish(g, anim);
    },

    // Chai stall: tin roof on bamboo poles, brass kettle, kulhads, and people on benches
    chai(level, color) {
      const g = new THREE.Group(), wood = M(WOODC, { roughness: .8 }), bamboo = M('#c9a96a', { roughness: .7 });
      g.add(RB(6.4, .15, 6.4, .05, M('#b9a07a', { roughness: 1 }), 0, .075, 0));
      for (const [x, z] of [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]]) g.add(cyl(.07, .08, z < 0 ? 3.1 : 2.6, bamboo, x, (z < 0 ? 3.1 : 2.6) / 2, z, 8));
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.3), texMat(tinTex(), { side: THREE.DoubleSide, metalness: .5, roughness: .45 }));
      roof.rotation.x = -Math.PI / 2 + .12; roof.position.set(0, 2.9, 0); roof.userData.keep = true; g.add(roof);
      g.add(plane(2.6, .7, texMat(signTex('चाय ☕', 'CHAI STALL', color)), 0, 2.45, 2.05));
      // counter with a painted front
      g.add(RB(3.4, 1.0, 1.1, .05, wood, 0, .65, .4));
      g.add(plane(3.3, .9, texMat(stripeTex(color, '#fff7e6')), 0, .62, .96));
      g.add(RB(3.5, .08, 1.2, .02, M('#d6d0c4', { roughness: .4 }), 0, 1.19, .4));
      // stove and the big brass kettle
      g.add(cyl(.32, .35, .3, M('#333'), -1, 1.38, .3, 14));
      g.add(lathe([[0, 0], [.32, 0], [.38, .15], [.36, .35], [.22, .5], [.12, .55], [.12, .62], [0, .62]], M('#c9962c', { metalness: .85, roughness: .3 }), -1, 1.53, .3, 20));
      g.add(rot(cyl(.03, .05, .4, M('#c9962c', { metalness: .85, roughness: .3 }), -.62, 1.85, .3, 8), 'z', -1));
      for (let i = 0; i < 3; i++) { // glass jars of biscuits
        g.add(cyl(.17, .17, .38, GLASS(), .3 + i * .42, 1.42, .55, 14));
        g.add(cyl(.14, .14, .25, M(pick(['#e0a040', '#c8783a', '#f2d06b'])), .3 + i * .42, 1.38, .55, 12));
        g.add(cyl(.18, .18, .06, M('#d32f2f'), .3 + i * .42, 1.64, .55, 14));
      }
      for (let i = 0; i < 6; i++) g.add(lathe([[0, 0], [.05, 0], [.07, .12], [0, .12]], M('#b5562c', { roughness: .9 }), -.2 + (i % 3) * .14, 1.24 + Math.floor(i / 3) * .12, .85, 10)); // kulhads
      // benches with customers
      const anim = [], ppl = [];
      for (const s of [-1, 1]) {
        g.add(RB(2.2, .1, .5, .03, wood, s * 1.6, .55, 2.6)); for (const x of [-.9, .9]) g.add(RB(.1, .5, .4, .02, wood, s * 1.6 + x, .3, 2.6));
        // seated on the bench, facing the stall, sipping chai
        const p = RM.person(); p.userData.parts.legL.rotation.x = p.userData.parts.legR.rotation.x = Math.PI / 2 - .15;
        p.scale.setScalar(.95); p.position.set(s * 1.6 + rnd(-.4, .4), .6 - .86 * .95, 2.6);
        ppl.push(p); anim.push(p);
      }
      const wala = RM.person({ woman: false, outfit: 'kurta', top: '#ffffff' }); wala.position.set(0, .15, -.6); wala.rotation.y = Math.PI; g.add(wala);
      if (level > 2) { g.add(RB(1.2, .06, 1.2, .02, M('#e53935'), 0, 1, 2.6 - 4)); }
      return finish(g, anim, [t => { ppl.forEach((p, i) => { p.userData.parts.armR.rotation.x = 1.5 + Math.max(0, Math.sin(t * 1.3 + i * 2)) * 1.0; p.userData.parts.head.rotation.y = Math.sin(t * .6 + i) * .3; }); }]);
    },

    // Donation booth: striped shamiana, a glass donation box full of notes, a volunteer
    donation(level, color) {
      const g = new THREE.Group(), anim = [];
      for (const [x, z] of [[-2.4, -2], [2.4, -2], [-2.4, 2], [2.4, 2]]) g.add(cyl(.06, .06, 3, M('#9e9e9e', { metalness: .6, roughness: .4 }), x, 1.5, z, 8));
      const can = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.2, 4, 1, true), texMat(stripeTex(color, '#fffaf0'), { side: THREE.DoubleSide, roughness: .9 }));
      can.position.y = 3.55; can.rotation.y = Math.PI / 4; can.userData.keep = true; g.add(can);
      g.add(RB(3.4, .9, 1.2, .04, M('#6d4c41'), 0, .45, 0));
      g.add(plane(3.3, .8, texMat(signTex('दान करें', 'DONATE · पार्टी फंड', color)), 0, .5, .61));
      const box = RB(.9, .8, .7, .04, GLASS(), .7, 1.3, 0); box.userData.keep = true; g.add(box);
      for (let i = 0; i < 14; i++) g.add(RB(.28, .02, .14, .005, M(pick(['#9ccc65', '#ffb74d', '#ce93d8', '#80deea'])), .7 + rnd(-.3, .3), .95 + rnd(0, .35), rnd(-.25, .25)));
      g.add(RB(.94, .06, .74, .02, M(color), .7, 1.73, 0));
      g.add(RB(.4, .02, .05, .01, M('#222'), .7, 1.77, 0));
      for (let i = 0; i < 6; i++) g.add(rot(cyl(.12, .12, .04, M(GOLD, { metalness: .8, roughness: .3 }), -.7 + (i % 3) * .3, .93 + Math.floor(i / 3) * .05, .1, 14), 'x', 0));
      if (level > 1) for (let i = 0; i < 3; i++) g.add(sph(.32, M('#a1887f', { roughness: 1 }), -1.9 + i * .5, .3, 1.4, 1, .9, 1));
      const vol = RM.person({ top: color }); vol.position.set(-.5, 0, -1.1); vol.rotation.y = Math.PI; g.add(vol);
      const giver = RM.person(); giver.position.set(1.0, 0, 1.3); giver.userData.parts.armR.rotation.x = 1.1; g.add(giver);
      flagPole(g, 2.4, 2, 4.2, color, 1.6); pullCloth(g, anim);
      return finish(g, anim);
    },

    // Karyakarta Bhavan: a workers' apartment block with balconies and a water tank
    hostel(level, color) {
      const g = new THREE.Group(), floors = 1 + Math.min(3, level), FH = 2.9, anim = [];
      const base = pick(['#f1c999', '#cfdcc8', '#f2e2a4', '#bcd2e2', '#e8bccb']);
      const W = 5.6, D = 5;
      g.add(mesh(new THREE.BoxGeometry(W, FH * floors, D), M(base, { roughness: .9 }), 0, FH * floors / 2, -.3));
      const front = texMat(wallTex(base, 3, floors, false, pick(['#ffffff', '#2f6f4f', '#2d5d8a'])));
      g.add(plane(W, FH * floors, front, 0, FH * floors / 2, -.3 + D / 2 + .01));
      g.add(rot(plane(D, FH * floors, texMat(wallTex(base, 3, floors, false)), W / 2 + .01, FH * floors / 2, -.3), 'y', Math.PI / 2));
      g.add(rot(plane(D, FH * floors, texMat(wallTex(base, 3, floors, false)), -W / 2 - .01, FH * floors / 2, -.3), 'y', -Math.PI / 2));
      const rail = M('#2b2b2b', { roughness: .5, metalness: .4 });
      for (let f = 1; f < floors; f++) {
        g.add(RB(W - .4, .14, 1, .03, M('#d6d0c4'), 0, f * FH, 2.7));
        g.add(rot(cyl(.03, .03, W - .4, rail, 0, f * FH + .9, 3.18, 6), 'z', Math.PI / 2));
        for (let x = -W / 2 + .3; x <= W / 2 - .2; x += .22) g.add(cyl(.015, .015, .8, rail, x, f * FH + .5, 3.18, 4));
        if (f % 2) laundry(g, 0, f * FH + 1.9, 3.1, 3.2);
      }
      g.add(RB(W + .2, .5, D + .2, .04, M(tint(base, .9)), 0, FH * floors + .25, -.3));
      waterTank(g, -1.3, FH * floors + .5, -1.2);
      g.add(RB(1.4, .8, .12, .04, M(color), 0, 2.2, 2.25));
      g.add(plane(2.6, .55, texMat(signTex('कार्यकर्ता भवन', 'KARYAKARTA BHAVAN', color)), 0, 2.5, 2.2 + .01));
      g.add(RB(1.2, 2, .1, .04, M('#5d3a1e'), 0, 1, 2.22));
      flagPole(g, 1.8, -1.6, FH * floors + 3, color, 1.6);
      pullCloth(g, anim);
      const w = RM.person({ top: color, outfit: 'kurta' }); w.position.set(1.4, 0, 2.9); w.rotation.y = Math.PI + .4; g.add(w);
      return finish(g, anim);
    },

    // Poster Press: brick shed with a sawtooth tin roof, posters on the walls
    poster(level, color) {
      const g = new THREE.Group(), anim = [];
      const brick = texMat(brickTex(), { roughness: .95 }); brick.map.repeat.set(3, 1.5);
      g.add(mesh(new THREE.BoxGeometry(6, 3, 5), brick, 0, 1.5, -.3));
      for (let i = 0; i < 3; i++) { // sawtooth roof
        const geo = new THREE.PlaneGeometry(2.25, 5.2); geo.rotateX(-Math.PI / 2); geo.rotateZ(.45);
        const r = mesh(geo, texMat(tinTex(), { side: THREE.DoubleSide, metalness: .5, roughness: .45 }), -2 + i * 2, 3.5, -.3);
        r.userData.keep = true; g.add(r);
        g.add(plane(2, .9, M('#9fc3dc', { roughness: .1, metalness: .3 }), -1.1 + i * 2, 3.45, -.3).rotateY(Math.PI / 2));
      }
      for (let i = 0; i < 4; i++) g.add(plane(.9, 1.15, texMat(posterTex(color, false)), -2.2 + i * 1.45, 1.6 + (i % 2) * .1, 2.21));
      g.add(RB(1.8, 2.2, .1, .04, M('#556', { metalness: .4, roughness: .5 }), 2, 1.1, 2.22));
      g.add(cyl(.25, .3, 3, brick, -2.4, 4.5, -2.2, 12));
      g.add(plane(3.2, .7, texMat(signTex('पोस्टर प्रेस', 'POSTER PRESS', '#37474f')), -.6, 2.7, 2.22));
      // paper stacks and a printing machine outside
      for (let i = 0; i < 3; i++) g.add(RB(.7, .4 + i * .2, .5, .04, M('#f5f5f0', { roughness: .9 }), 2.3, .2 + i * .1, 3.1 - i * .6));
      g.add(RB(1.4, 1, .9, .1, M('#455a64', { metalness: .5, roughness: .45 }), -1.8, .5, 3.2));
      for (const y of [.75, .45]) g.add(rot(cyl(.12, .12, 1.3, CHROME(), -1.8, y, 3.68, 12), 'z', Math.PI / 2));
      if (level > 2) g.add(RB(2, 2, 3, .04, brick, 3.7, 1, -.5));
      const wk = RM.person({ top: '#5d4037' }); wk.position.set(-.6, 0, 3.4); wk.rotation.y = -1.2; g.add(wk);
      return finish(g, anim);
    },

    // Party Fund Bank: steps, columns, pediment, golden ₹ emblem, ATM
    bank(level, color) {
      const g = new THREE.Group(), white = M(WHITE, { roughness: .55 }), stone = M(STONE, { roughness: .85 }), anim = [];
      g.add(RB(6.4, .4, 6, .05, stone, 0, .2, 0));
      g.add(mesh(new THREE.BoxGeometry(5.2, 3.6, 4), M(SAND, { roughness: .85 }), 0, 2.2, -.6));
      g.add(plane(5.2, 3.6, texMat(wallTex(SAND, 4, 1, true)), 0, 2.2, 1.41));
      steps(g, 5, 3, 0, 2.15, stone, .35);
      for (let i = 0; i < 4; i++) { const c = column(3.3, .18, white); c.position.set(-1.8 + i * 1.2, .9, 2.3); g.add(c); }
      g.add(RB(5.4, .5, 1.6, .05, white, 0, 4.45, 1.9));
      g.add(RB(5.4, .3, 4.6, .05, white, 0, 4.15, -.6));
      const ped = pediment(5.4, 1.2, 1.5, white); ped.position.set(0, 4.7, 1.9); g.add(ped);
      g.add(rot(cyl(.42, .42, .1, M(GOLD, { metalness: .9, roughness: .25 }), 0, 5.15, 2.68, 28), 'x', Math.PI / 2));
      g.add(plane(.6, .6, texMat(once('rupee', () => { const [c, x] = canvas(64, 64); x.fillStyle = '#7a5200'; x.font = `bold 52px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('₹', 32, 34); return tex(c); }), { transparent: true }), 0, 5.15, 2.74));
      g.add(plane(3.6, .5, texMat(signTex('पार्टी फंड बैंक', 'PARTY FUND BANK', '#0d47a1')), 0, 3.6, 1.42));
      g.add(RB(1.2, 2.1, .08, .04, M('#3e2723', { roughness: .5 }), 0, 1.45, 1.42));
      g.add(RB(1, 2.2, .9, .06, M(color), 2.6, 1.5, -2.2));                  // ATM kiosk
      g.add(plane(.6, .3, M('#4fc3f7', { emissive: '#4fc3f7', emissiveIntensity: .6 }), 2.6, 1.8, -1.74));
      if (level > 2) g.add(mesh(new THREE.BoxGeometry(2, 4.5, 2.4), M(SAND), -2.9, 2.6, -1.4));
      const guard = RM.person({ woman: false, top: '#6d7b3a', bottom: '#5c6a30', outfit: 'shirt', cap: '#3b4a1e' });
      guard.position.set(1.9, .4, 3); guard.rotation.y = Math.PI; g.add(guard);
      return finish(g, anim);
    },

    // Rally ground: stage with a giant backdrop, loudspeakers, bunting, a cheering crowd
    rally(level, color) {
      const g = new THREE.Group(), wood = M('#7b5537', { roughness: .8 }), anim = [];
      const dustM = new THREE.MeshStandardMaterial({ map: once('dust', () => { const t = RT.dust(); t.repeat.set(3, 3); return t; }), roughness: 1 });
      g.add(mesh(new THREE.BoxGeometry(13.4, .12, 13.4), dustM, 0, .06, 0));
      g.add(RB(8, 1.4, 3.2, .05, wood, 0, .7, -4.6));
      g.add(plane(8, 1.2, texMat(stripeTex(color, '#ffffff')), 0, .7, -2.99));
      steps(g, 1.6, 3, 2.8, -2.7, wood, .3);
      g.add(RB(8.6, 4.4, .2, .05, M('#444'), 0, 3.6, -6.1));
      g.add(plane(8.2, 4, texMat(posterTex(color, true)), 0, 3.6, -5.99));
      g.add(RB(.8, 1.1, .5, .05, M('#5d4037'), 0, 1.95, -4.2));                         // podium
      for (const x of [-.12, .12]) g.add(tube([V(x, 2.5, -4.2), V(x, 2.8, -4.0)], .015, M('#222'), 4));
      for (let i = 0; i < 16; i++) { const a = i / 15; g.add(sph(.08, M(i % 2 ? '#ff9800' : '#ffd54f', { roughness: .9 }), -4 + a * 8, 1.32 - Math.sin(a * Math.PI) * .25, -3)); } // marigolds
      for (const s of [-1, 1]) {
        g.add(cyl(.08, .1, 6, M('#8d8d8d', { metalness: .6 }), s * 5.6, 3, -4.4, 8));
        loudspeaker(g, s * 5.6, 5.6, -4.3, s * .5); loudspeaker(g, s * 5.6, 5.0, -4.3, s * .5 + .4);
        g.add(RB(1, 1.6, .8, .08, M('#1f1f1f', { roughness: .4 }), s * 4.6, 2.2, -4.2));        // speaker boxes
      }
      // bunting over the ground
      for (const z of [-1, 2.5]) {
        const b = RM.bunting(); b.scale.set(1.25, 1, 1); b.position.set(0, 0, z); g.add(b);
      }
      const leader = RM.person({ woman: false, outfit: 'kurta', top: '#ffffff' }); leader.position.set(0, 1.4, -4.8); leader.rotation.y = Math.PI; anim.push(leader);
      const rows = crowd(3 + Math.min(2, level - 1), 9, 1.15, 1.25, color);
      rows.forEach((r, i) => { r.position.set(0, .12, -.6 + i * 1.25); anim.push(r); });
      for (const s of [-1, 1]) { flagPole(g, s * 6.2, 5.6, 6, color, 1.8); }
      pullCloth(g, anim);
      return finish(g, anim, [t => {
        rows.forEach(r => { r.position.y = .12 + Math.abs(Math.sin(t * 4 + r.userData.phase)) * .12; });
        leader.userData.parts.armR.rotation.x = 2.7 + Math.sin(t * 2) * .3; leader.userData.parts.head.rotation.y = Math.sin(t * .8) * .5;
      }]);
    },

    // TV Tower: a red-and-white lattice tower with dishes and a blinking light
    tv(level, color) {
      const g = new THREE.Group(), anim = [];
      g.add(RB(6, .3, 6, .05, M(STONE), 0, .15, 0));
      const tw = RM.tower(); g.add(tw);
      for (let i = 0; i < 3; i++) {
        const d = mesh(new THREE.SphereGeometry(.9, 16, 8, 0, Math.PI * 2, 0, .9), M('#eceff1', { side: THREE.DoubleSide, roughness: .35 }), Math.cos(i * 2.1) * .9, 12 + i * 2.5, Math.sin(i * 2.1) * .9);
        d.rotation.set(-1.4, i * 2.1, 0); g.add(d);
      }
      g.add(RB(3, 2.6, 2.4, .08, M('#eceae4'), 2, 1.6, 2)); g.add(plane(1.8, .5, texMat(signTex('टीवी केंद्र', 'TV STATION', color)), 2, 2.4, 3.21));
      for (const x of [1.1, 2.9]) { const d = mesh(new THREE.SphereGeometry(.5, 14, 8, 0, Math.PI * 2, 0, .9), M('#f5f5f5', { side: THREE.DoubleSide, roughness: .35 }), x, 3.3, 2); d.rotation.x = -1.2; g.add(d); }
      const light = sph(.35, GLOW('#ff1744'), 0, 22.6, 0); light.userData.keep = true; anim.push(light);
      return finish(g, anim, [t => { light.visible = Math.sin(t * 5) > 0; }]);
    },

    tree() {
      const g = new THREE.Group();
      g.add(RB(2.4, .3, 2.4, .1, M('#a99d88'), 0, .15, 0));
      g.add(cyl(1, 1.05, .1, M('#6b4a2e', { roughness: 1 }), 0, .32, 0, 20));
      const t = RM.tree(); t.scale.setScalar(1.45); t.position.y = .3; g.add(t);
      const out = finish(g);
      out.userData.sway = Math.random() * 6;
      return out;
    },

    flag(level, color) {
      const g = new THREE.Group(), anim = [];
      for (let i = 0; i < 3; i++) g.add(cyl(1.5 - i * .4, 1.5 - i * .4, .25, M(STONE, { roughness: .9 }), 0, .125 + i * .25, 0, 24));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(sph(.18, M(i % 2 ? '#ff9800' : '#ffeb3b', { roughness: .9 }), Math.cos(a) * 1.0, .82, Math.sin(a) * 1.0)); }
      flagPole(g, 0, 0, 7.5, color, 3); pullCloth(g, anim);
      return finish(g, anim);
    },
  };

  // under construction: bamboo scaffolding, rising brick walls, a turning crane
  function scaffold(size) {
    const g = new THREE.Group(), w = size * TILE * .72, bamboo = M('#c9a96a', { roughness: .7 }), anim = [];
    const brick = texMat(brickTex(), { roughness: .95 }); brick.map.repeat.set(2, 1);
    g.add(mesh(new THREE.BoxGeometry(w * .8, 1.6, w * .8), brick, 0, .8, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) g.add(cyl(.06, .06, 4.2, bamboo, x * w / 2, 2.1, z * w / 2, 6));
    for (const y of [1.2, 2.4, 3.6]) {
      for (const s of [-1, 1]) {
        g.add(rot(cyl(.05, .05, w, bamboo, 0, y, s * w / 2, 6), 'z', Math.PI / 2));
        g.add(rot(cyl(.05, .05, w, bamboo, s * w / 2, y, 0, 6), 'x', Math.PI / 2));
        g.add(RB(w, .06, .5, .01, M('#9a7a50'), 0, y + .05, s * (w / 2 - .25)));
      }
    }
    g.add(lathe([[0, 0], [1.2, 0], [0, .9]], M('#d8c094', { roughness: 1 }), w / 2 + .6, 0, w / 2 + .4, 16)); // sand
    for (let i = 0; i < 4; i++) g.add(RB(1, .25, .5, .02, M('#b45535'), -w / 2 - .4, .13 + i * .26, w / 2 - .5));
    const crane = new THREE.Group(), y = M('#f2b632', { roughness: .5, metalness: .3 });
    crane.add(RB(.4, 6, .4, .05, y, 0, 3, 0));
    crane.add(RB(5, .3, .3, .05, y, 1.6, 6, 0));
    crane.add(RB(.8, .8, .8, .05, M('#555'), -.8, 5.6, 0));
    crane.add(cyl(.01, .01, 2, M('#222'), 3.6, 5, 0, 4));
    crane.add(RB(.6, .3, .4, .03, M('#b45535'), 3.6, 3.9, 0));
    const cb = bake(crane); cb.position.set(-w / 2, 0, -w / 2); anim.push(cb);
    const wk = RM.person({ top: '#ff8f00', cap: '#ffd600' }); wk.position.set(w / 2 + .2, 0, -w / 2 + 1); anim.push(wk);
    return finish(g, anim, [t => { cb.rotation.y = t * .6; RM.animatePerson(wk, t, 0); }]);
  }

  // a townsperson; World makes them walk around the ring road
  function person(color) {
    const p = RM.person({ top: Math.random() < .5 ? color : undefined });
    const out = new THREE.Group(); p.scale.setScalar(1 / TILE); out.add(p);
    out.userData.walk = t => RM.animatePerson(p, t, 1);
    return out;
  }

  // the rival party's campaign jeep with a loudspeaker on top
  function jeep() {
    const g = new THREE.Group(), white = M('#f4f4f2', { roughness: .35, metalness: .15 }), red = M('#d32f2f', { roughness: .4 }), dark = M('#26262a', { roughness: .6 });
    g.add(RB(3.8, .9, 1.7, .15, white, 0, .95, 0));
    g.add(RB(1.4, .35, 1.6, .15, white, 1.15, 1.55, 0));                   // bonnet
    g.add(RB(3.82, .14, 1.72, .05, red, 0, 1.2, 0));
    g.add(RB(.08, .7, 1.4, .03, dark, 1.9, 1.05, 0));                        // grille
    for (let i = -3; i <= 3; i++) g.add(RB(.1, .55, .06, .02, CHROME(), 1.94, 1.05, i * .18));
    for (const z of [-.6, .6]) { g.add(rot(cyl(.15, .15, .1, CHROME(), 1.92, 1.25, z, 14), 'z', Math.PI / 2)); g.add(rot(cyl(.12, .12, .02, GLOW('#fff8e1'), 1.98, 1.25, z, 14), 'z', Math.PI / 2)); }
    const ws = RB(.05, .7, 1.6, .03, GLASS(), .4, 1.9, 0); ws.rotation.z = -.2; ws.userData.keep = true; g.add(ws);
    g.add(tube([V(-1.4, 1.4, -.8), V(-1.4, 2.4, -.8), V(-1.4, 2.4, .8), V(-1.4, 1.4, .8)], .05, dark, 12));
    g.add(RB(.6, .4, .6, .1, M('#555'), -.7, 2.0, 0));
    loudspeaker(g, -.7, 2.4, .25, Math.PI / 2 + .3); loudspeaker(g, -.7, 2.4, -.25, -Math.PI / 2 - .3);
    g.add(rot(cyl(.4, .4, .25, dark, -1.98, 1.1, 0, 16), 'z', Math.PI / 2));   // spare wheel
    g.add(plane(1.5, .45, texMat(signTex('विरोधी पार्टी', 'R S P', '#c62828')), 0, 1.0, .86));
    g.add(rot(plane(1.5, .45, texMat(signTex('विरोधी पार्टी', 'R S P', '#c62828')), 0, 1.0, -.86), 'y', Math.PI));
    const anim = [];
    for (const [x, z] of [[1.2, -.85], [1.2, .85], [-1.2, -.85], [-1.2, .85]]) { const w = wheel(.42, .28); w.position.set(x, .42, z); anim.push(w); }
    const drv = RM.person({ woman: false, top: '#c62828' }); drv.userData.parts.legL.rotation.x = drv.userData.parts.legR.rotation.x = Math.PI / 2 - .1;
    drv.position.set(.1, .55, .4); drv.rotation.y = -Math.PI / 2; drv.scale.setScalar(.9); anim.push(drv);
    flagPole(g, -1.6, -.6, 3, '#c62828', 1.1, '🦁'); pullCloth(g, anim);
    return finish(g, anim);
  }

  function build(type, level, color) {
    const g = builders[type](level, color);
    g.traverse(o => { o.userData.type = type; });
    return g;
  }

  return { build, scaffold, person, jeep, flagTex, TILE };
})();
