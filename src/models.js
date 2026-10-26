// RAJNEETI 3D — low-poly models built from simple shapes. One world unit = one tile.

const Models = (() => {
  const mats = new Map();
  function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, flatShading: true, ...opts }));
    return mats.get(key);
  }
  function mesh(geo, color, x = 0, y = 0, z = 0, opts) {
    const m = new THREE.Mesh(geo, mat(color, opts));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const box = (w, h, d, c, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, o);
  const cyl = (rt, rb, h, c, x, y, z, seg = 8, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z, o);
  const cone = (r, h, c, x, y, z, seg = 4, o) => mesh(new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z, o);
  // a triangular gable (pediment) of width w and height h, depth d, facing +z
  function gable(w, h, d, c, x, y, z) {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    const m = mesh(geo, c, x, y, z - d / 2);
    return m;
  }
  const rot = (m, axis, v) => { m.rotation[axis] = v; return m; };
  const ball = (r, c, x, y, z, detail = 0) => mesh(new THREE.IcosahedronGeometry(r, detail), c, x, y, z);

  const WALL = '#fff4e0', WALL2 = '#ffe2b8', ROOF = '#d9653b', WOOD = '#9a6b3f', GLASS = '#2f4b6e', GOLD = '#f2b632', WHITE = '#ffffff', DARK = '#3a3a48';

  // a row of windows along one face
  function windows(g, w, y, z, n, h = .14) {
    for (let i = 0; i < n; i++) g.add(box(.14, h, .02, GLASS, -w / 2 + (i + .5) * (w / n), y, z));
  }

  function flagPole(g, x, z, h, color) {
    g.add(cyl(.025, .03, h, '#cfd3da', x, 0, z, 6));
    const f = box(.36, .22, .02, color, x + .19, h - .26, z);
    f.userData.flag = true;
    g.add(f);
    g.add(ball(.04, GOLD, x, h + .03, z));
    return f;
  }

  const builders = {
    hq(level, color) {
      const g = new THREE.Group(), floors = Math.min(4, 1 + Math.floor(level / 1.5));
      g.add(box(1.8, .08, 1.8, '#e8dcc8', 0, 0, 0));           // plinth
      g.add(box(1.8, .06, .5, '#d8cbb3', 0, 0, .95));          // steps
      for (let f = 0; f < floors; f++) {
        const y = .08 + f * .42, w = 1.5 - f * .12;
        g.add(box(w, .42, w, f % 2 ? WALL2 : WALL, 0, y, 0));
        windows(g, w, y + .2, w / 2 + .01, 5);
        windows(g, w, y + .2, -w / 2 - .01, 5);
        g.add(box(w + .06, .04, w + .06, color, 0, y + .4, 0));  // party-colour band
      }
      const top = .08 + floors * .42;
      // dome like a government building
      g.add(cyl(.3, .34, .14, WALL, 0, top, 0, 12));
      g.add(mesh(new THREE.SphereGeometry(.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, 0, top + .14, 0));
      // portico with columns
      for (let i = -2; i <= 2; i++) g.add(cyl(.04, .05, .42, WHITE, i * .22, .08, .82, 8));
      g.add(box(1.15, .06, .3, WHITE, 0, .5, .78));
      g.add(gable(1.2, .26, .3, WHITE, 0, .56, .78));
      g.add(box(.5, .12, .02, color, 0, .3, .76 + .02));        // sign board
      g.userData.flags = [flagPole(g, .7, .7, 1.2 + floors * .2, color)];
      return g;
    },
    chai(level, color) {
      const g = new THREE.Group();
      g.add(box(.7, .35, .5, WALL2, 0, 0, -.1));
      g.add(box(.72, .04, .52, WOOD, 0, .35, -.1));
      // striped awning
      for (let i = 0; i < 6; i++) g.add(rot(box(.13, .03, .45, i % 2 ? WHITE : color, -.33 + i * .133, .42, .2), 'x', .25));
      g.add(box(.6, .2, .06, WOOD, 0, 0, .28));                 // counter
      g.add(cyl(.06, .07, .1, '#b0b6c0', .18, .2, .28, 8));     // kettle
      g.add(cyl(.02, .02, .05, '#b0b6c0', .26, .26, .28, 6));
      for (let i = 0; i < 3; i++) g.add(cyl(.025, .02, .05, WHITE, -.2 + i * .09, .2, .3, 6)); // cups
      g.add(box(.5, .06, .12, WOOD, 0, .14, .5));                // bench
      if (level > 2) g.add(box(.3, .3, .3, WALL, .45, 0, -.25));
      return g;
    },
    donation(level, color) {
      const g = new THREE.Group();
      g.add(box(.35, .5, .3, color, 0, 0, 0));
      g.add(box(.38, .04, .33, GOLD, 0, .5, 0));
      g.add(box(.18, .02, .02, DARK, 0, .4, .16));             // slot
      g.add(rot(cyl(.09, .09, .02, GOLD, 0, .2, .16, 12), 'x', Math.PI / 2));
      if (level > 1) { g.add(box(.5, .04, .4, WOOD, 0, 0, 0)); g.add(cyl(.12, .12, .05, GOLD, .3, .04, .2, 10)); }
      return g;
    },
    hostel(level) {
      const g = new THREE.Group(), floors = 1 + Math.min(3, level);
      for (let f = 0; f < floors; f++) {
        g.add(box(.75, .3, .7, f % 2 ? WALL : '#cfe8f7', 0, f * .3, 0));
        windows(g, .75, f * .3 + .13, .36, 3);
      }
      g.add(rot(cone(.6, .3, ROOF, 0, floors * .3, 0, 4), 'y', Math.PI / 4));
      g.add(box(.18, .22, .02, WOOD, 0, 0, .36));
      return g;
    },
    poster(level, color) {
      const g = new THREE.Group();
      g.add(box(.85, .45, .7, '#d7dde6', 0, 0, 0));
      for (let i = 0; i < 3; i++) g.add(rot(box(.28, .14, .7, '#8f99a8', -.28 + i * .28, .45, 0), 'z', .5)); // sawtooth roof
      // posters on the front
      [color, '#f2b632', '#3aa0e8'].forEach((c, i) => g.add(box(.18, .22, .02, c, -.26 + i * .26, .1, .36)));
      g.add(cyl(.05, .05, .5, '#8f99a8', .32, .45, -.2, 6));    // chimney
      if (level > 2) g.add(box(.3, .3, .5, '#d7dde6', .55, 0, 0));
      return g;
    },
    bank(level, color) {
      const g = new THREE.Group();
      g.add(box(.85, .08, .75, '#e8dcc8', 0, 0, 0));
      g.add(box(.75, .45, .55, WALL, 0, .08, -.05));
      for (let i = -1.5; i <= 1.5; i++) g.add(cyl(.035, .04, .42, WHITE, i * .18, .08, .28, 8));
      g.add(gable(.85, .22, .4, WHITE, 0, .55, .12));
      g.add(box(.8, .05, .6, WHITE, 0, .5, -.05));
      g.add(rot(cyl(.11, .11, .03, GOLD, 0, .62, .32, 12), 'x', Math.PI / 2));
      if (level > 2) g.add(box(.3, .6, .3, WALL2, -.4, .08, -.25));
      return g;
    },
    rally(level, color) {
      const g = new THREE.Group();
      g.add(box(1.85, .03, 1.85, '#c9a36a', 0, 0, 0));          // dusty ground
      g.add(box(1, .25, .45, WOOD, 0, 0, -.6));                 // stage
      g.add(box(1.1, .5, .04, color, 0, .25, -.82));            // backdrop
      g.add(box(.7, .12, .02, WHITE, 0, .55, -.8));             // banner
      for (const x of [-.6, .6]) { g.add(box(.18, .4, .16, DARK, x, 0, -.55)); g.add(rot(cyl(.05, .05, .04, '#666', x, .3, -.46, 8), 'x', Math.PI / 2)); }
      // crowd
      const colors = ['#e94f37', '#3aa0e8', '#f2b632', '#6bbf59', '#a26dd6', '#ff8a5b', '#ffffff'];
      let i = 0;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
        const x = -.66 + c * .22 + (r % 2) * .1, z = .05 + r * .26;
        const p = new THREE.Group();
        p.add(cyl(.05, .06, .14, colors[(i++ * 3) % colors.length], 0, 0, 0, 6));
        p.add(ball(.05, '#c68a5c', 0, .19, 0));
        p.position.set(x, 0, z);
        p.userData.bob = Math.random() * 6;
        g.add(p);
      }
      g.userData.crowd = true;
      flagPole(g, -.85, -.85, .9, color); flagPole(g, .85, -.85, .9, color);
      return g;
    },
    tv(level, color) {
      const g = new THREE.Group();
      for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) {
        const leg = cyl(.025, .03, 1.6, '#e94f37', x * .6, 0, z * .6, 5);
        leg.rotation.set(-z * .12, 0, x * .12); g.add(leg);
      }
      for (let h = .3; h < 1.6; h += .3) g.add(box(.26 - h * .08, .03, .26 - h * .08, WHITE, 0, h, 0));
      g.add(cyl(.02, .02, .4, WHITE, 0, 1.6, 0, 5));
      const dish = mesh(new THREE.SphereGeometry(.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), '#dfe5ec', .12, 1.25, .12);
      dish.rotation.set(-1.2, .8, 0); g.add(dish);
      const light = ball(.04, '#ff3b3b', 0, 2.02, 0); light.userData.blink = true; g.add(light);
      g.add(box(.5, .12, .5, '#cfd3da', 0, 0, 0));
      return g;
    },
    tree() {
      const g = new THREE.Group();
      g.add(cyl(.05, .07, .3, WOOD, 0, 0, 0, 6));
      g.add(ball(.24, '#4f9d3a', 0, .42, 0));
      g.add(ball(.17, '#62b549', .1, .56, .05));
      g.add(ball(.15, '#3f8a2f', -.1, .52, -.06));
      g.userData.sway = Math.random() * 6;
      return g;
    },
    flag(level, color) {
      const g = new THREE.Group();
      g.add(cyl(.1, .12, .06, '#d8cbb3', 0, 0, 0, 8));
      g.userData.flags = [flagPole(g, 0, 0, 1, color)];
      return g;
    },
  };

  // scaffolding shown while a building is under construction
  function scaffold(size) {
    const g = new THREE.Group(), w = size * .8;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(.02, .02, .6, '#c99a5a', x * w / 2, 0, z * w / 2, 4));
    for (const y of [.2, .4, .6]) {
      g.add(box(w, .02, .03, '#c99a5a', 0, y, w / 2)); g.add(box(w, .02, .03, '#c99a5a', 0, y, -w / 2));
      g.add(box(.03, .02, w, '#c99a5a', w / 2, y, 0)); g.add(box(.03, .02, w, '#c99a5a', -w / 2, y, 0));
    }
    g.add(box(w * .7, .25, w * .7, '#cfc6b8', 0, 0, 0));
    const crane = new THREE.Group();
    crane.add(cyl(.025, .025, 1, '#f2b632', 0, 0, 0, 4));
    crane.add(box(.7, .04, .04, '#f2b632', .25, 1, 0));
    crane.position.set(-w / 2, 0, -w / 2);
    crane.userData.spin = true;
    g.add(crane);
    return g;
  }

  // a little person who walks around town
  function person(color) {
    const g = new THREE.Group();
    g.add(cyl(.035, .045, .13, color, 0, 0, 0, 6));
    g.add(ball(.04, '#c68a5c', 0, .17, 0));
    return g;
  }

  // the RSP jeep that sometimes drives through town
  function jeep() {
    const g = new THREE.Group();
    g.add(box(.5, .14, .26, '#d64541', 0, .06, 0));
    g.add(box(.26, .14, .24, '#f5f5f5', -.04, .2, 0));
    g.add(box(.02, .1, .2, GLASS, .1, .22, 0));
    for (const [x, z] of [[-.16, -.13], [.16, -.13], [-.16, .13], [.16, .13]]) g.add(rot(cyl(.06, .06, .04, DARK, x, .06, z, 10), 'x', Math.PI / 2));
    g.add(cyl(.01, .01, .45, '#ccc', -.2, .2, .08, 4));
    const f = box(.22, .14, .01, '#d64541', -.09, .5, .08); f.userData.flag = true; g.add(f);
    g.add(box(.12, .1, .12, '#333', .15, .27, 0)); // loudspeaker
    return g;
  }

  function build(type, level, color) {
    const g = builders[type](level, color);
    g.traverse(o => { o.userData.type = type; });
    return g;
  }

  return { build, scaffold, person, jeep, box, cyl, cone, ball, mat };
})();
