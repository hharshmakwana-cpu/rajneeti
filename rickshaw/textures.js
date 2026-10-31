// RICKSHAW RUSH — textures painted at start-up on canvases: asphalt, paving,
// shop fronts with Hindi/English signboards, bus livery and number plates.
// Nothing is downloaded, so the game still works offline.

const RT = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const DEVA = '"Noto Sans Devanagari", "Mangal", "Kohinoor Devanagari", sans-serif';
  const SANS = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function tex(c, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  }
  // fine speckle so flat colours read as real surfaces
  function grain(g, w, h, amt, n) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * amt})`;
      const s = rnd(1, 3);
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ---------- road ----------
  // One tile covers the full road width (6.2) and 6.2 units of length.
  function asphalt() {
    const S = 512, [c, g] = canvas(S, S);
    g.fillStyle = '#55575c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { // repaired patches
      g.fillStyle = `rgba(${Math.random() < .5 ? '30,30,34' : '110,108,104'},${rnd(.08, .22)})`;
      g.beginPath(); g.ellipse(rnd(0, S), rnd(0, S), rnd(10, 60), rnd(8, 40), rnd(0, 3), 0, 7); g.fill();
    }
    const px = x => (x + 3.1) / 6.2 * S;
    for (const x of [-1.7, 0, 1.7]) { // tyre-worn tracks
      const gr = g.createLinearGradient(px(x - .6), 0, px(x + .6), 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.25, 'rgba(20,20,24,.18)'); gr.addColorStop(.5, 'rgba(0,0,0,0)');
      gr.addColorStop(.75, 'rgba(20,20,24,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px(x - .6), 0, px(x + .6) - px(x - .6), S);
    }
    g.strokeStyle = 'rgba(25,25,28,.55)'; g.lineWidth = 1.2; // cracks
    for (let i = 0; i < 12; i++) {
      let x = rnd(0, S), y = rnd(0, S); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rnd(-14, 14); y += rnd(-14, 14); g.lineTo(x, y); }
      g.stroke();
    }
    grain(g, S, S, .18, 26000);
    // lane dashes and edge lines, slightly worn
    g.fillStyle = 'rgba(245,245,240,.92)';
    for (const x of [-.85, .85]) g.fillRect(px(x) - 4, 40, 8, 200);
    for (const x of [-.85, .85]) g.fillRect(px(x) - 4, 296, 8, 200);
    g.fillStyle = 'rgba(245,215,80,.9)';
    g.fillRect(px(-2.95) - 4, 0, 7, S); g.fillRect(px(2.95) - 3, 0, 7, S);
    grain(g, S, S, .25, 5000);
    return tex(c);
  }

  function paving() {
    const S = 256, [c, g] = canvas(S, S);
    g.fillStyle = '#9b948a'; g.fillRect(0, 0, S, S);
    const cols = ['#a8a196', '#b6a99a', '#8f877d', '#b88f7a', '#a37a68'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = cols[(x + y * 3) % 5 === 0 ? 3 + (x % 2) : Math.floor(Math.random() * 3)];
      g.fillRect(x * 32 + 2 + (y % 2) * 16 % 32, y * 32 + 2, 28, 28);
    }
    g.fillStyle = 'rgba(70,60,50,.35)';
    for (let y = 0; y <= 8; y++) g.fillRect(0, y * 32, S, 2);
    grain(g, S, S, .2, 9000);
    return tex(c, 1, 6);
  }

  function kerb() {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#1d1d1f'; g.fillRect(0, 32, 64, 32);
    grain(g, 64, 64, .3, 900);
    return tex(c, 1, 10);
  }

  function dust() {
    const S = 256, [c, g] = canvas(S, S);
    g.fillStyle = '#c4ad84'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${Math.random() < .5 ? '140,120,90' : '215,200,170'},${rnd(.1, .3)})`;
      g.beginPath(); g.arc(rnd(0, S), rnd(0, S), rnd(6, 30), 0, 7); g.fill();
    }
    grain(g, S, S, .25, 12000);
    return tex(c, 12, 4);
  }

  // ---------- shop fronts ----------
  const PLASTER = ['#eadbc0', '#f1c999', '#cfdcc8', '#e5ab86', '#f2e2a4', '#bcd2e2', '#e8bccb', '#ddd7cd', '#f3efe6', '#d9a07a', '#c7b8e0', '#a9d6cf'];
  const FRAMES = ['#f7f7f2', '#2f6f4f', '#2d5d8a', '#7a4b2a', '#d9d9d9', '#8a2f2f'];
  const SHOPS = [
    ['शर्मा जनरल स्टोर', 'SHARMA GENERAL STORE', '#c62828', '#ffeb3b'],
    ['मिठाई भंडार', 'GUPTA SWEETS', '#ff8f00', '#ffffff'],
    ['मोबाइल रिपेयर', 'MOBILE REPAIRING', '#1565c0', '#ffffff'],
    ['चाय की दुकान', 'CHAI POINT', '#4e342e', '#ffcc80'],
    ['मेडिकल स्टोर', 'MEDICAL STORE', '#2e7d32', '#ffffff'],
    ['कपड़ा केंद्र', 'FASHION SAREES', '#ad1457', '#fff59d'],
    ['किराना', 'KIRANA STORE', '#6a1b9a', '#ffffff'],
    ['हलवाई', 'AGARWAL HALWAI', '#ef6c00', '#fffde7'],
    ['बैंक', 'STATE BANK', '#0d47a1', '#ffffff'],
    ['ढाबा', 'PUNJABI DHABA', '#b71c1c', '#ffe082'],
    ['हार्डवेयर', 'JAIN HARDWARE', '#37474f', '#ffd54f'],
    ['फोटो स्टूडियो', 'PHOTO STUDIO', '#00838f', '#ffffff'],
  ];
  const PX = 64; // pixels per world unit

  function signboard(g, x, y, w, h, shop) {
    const [hi, en, bg, fg] = shop;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, shade(bg, 1.15)); gr.addColorStop(1, shade(bg, .85));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (txt, font, size, yy) => {
      g.font = `bold ${size}px ${font}`;
      const s = Math.min(1, (w - 16) / g.measureText(txt).width);
      g.save(); g.translate(x + w / 2, yy); g.scale(s, 1); g.fillText(txt, 0, 0); g.restore();
    };
    fit(hi, DEVA, h * .42, y + h * .34);
    fit(en, SANS, h * .26, y + h * .76);
  }

  function windowAt(g, x, y, w, h, frame) {
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - 3, y - 3, w + 6, h + 10); // recess shadow
    g.fillStyle = frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    const gl = g.createLinearGradient(x, y, x + w, y + h);
    gl.addColorStop(0, '#9fc3dc'); gl.addColorStop(.45, '#46617a'); gl.addColorStop(1, '#263544');
    g.fillStyle = gl; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    if (Math.random() < .55) { // curtain
      g.fillStyle = pick(['#d84315', '#f9a825', '#6a1b9a', '#00897b', '#c2185b', '#eeeeee']);
      g.globalAlpha = .85; g.fillRect(x + 2, y + 2, (w - 4) * rnd(.3, .5), h - 4); g.globalAlpha = 1;
    }
    g.fillStyle = frame; g.fillRect(x + w / 2 - 1.5, y, 3, h);
    g.fillStyle = 'rgba(30,30,30,.75)'; // safety grille
    for (let i = 1; i < 5; i++) g.fillRect(x, y + i * h / 5, w, 1.5);
    // chajja (concrete sunshade) above
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 8, y - 6, w + 16, 10);
    g.fillStyle = '#d8d2c6'; g.fillRect(x - 8, y - 12, w + 16, 7);
  }

  function shopFront(g, x, y, w, h) {
    if (Math.random() < .3) { // rolling shutter, closed
      g.fillStyle = '#8c9096'; g.fillRect(x, y, w, h);
      for (let i = 0; i < h; i += 5) { g.fillStyle = i % 10 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.25)'; g.fillRect(x, y + i, w, 2); }
      g.fillStyle = '#444'; g.fillRect(x + w / 2 - 6, y + h - 14, 12, 8);
      g.fillStyle = 'rgba(200,40,40,.7)'; g.font = `bold 13px ${SANS}`; g.textAlign = 'center';
      g.fillText(pick(['TO-LET', 'NO PARKING', '', '', 'BOOK NOW 98XXX']), x + w / 2, y + h * .45);
      return;
    }
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#1f1a16'); gr.addColorStop(1, '#4a3d33');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const goods = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#f5f5f5', '#6d4c41'];
    for (let r = 0; r < 4; r++) { // shelves of goods
      const sy = y + 8 + r * (h - 16) / 4;
      g.fillStyle = '#7a5a40'; g.fillRect(x + 4, sy + (h - 16) / 4 - 4, w - 8, 3);
      for (let i = x + 6; i < x + w - 10; i += rnd(6, 11)) {
        g.fillStyle = pick(goods); const bh = rnd(6, (h - 16) / 4 - 6);
        g.fillRect(i, sy + (h - 16) / 4 - 4 - bh, rnd(4, 8), bh);
      }
    }
    g.fillStyle = 'rgba(255,230,160,.12)'; g.fillRect(x, y, w, h); // tube-light glow
    g.fillStyle = '#9aa0a6'; g.fillRect(x, y, w, 6); // rolled-up shutter
  }

  // Front face of a building: shop on the ground floor and `floors` storeys above.
  function facade(floors, cols) {
    const wU = cols * 1.15 + .5, hU = 2.2 + floors * 1.3 + .35;
    const W = Math.round(wU * PX), H = Math.round(hU * PX), [c, g] = canvas(W, H);
    const base = pick(PLASTER), frame = pick(FRAMES);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { // faded and repainted patches
      g.fillStyle = `rgba(${Math.random() < .6 ? '255,255,255' : '90,80,60'},${rnd(.05, .14)})`;
      g.fillRect(rnd(0, W), rnd(0, H * .8), rnd(20, 80), rnd(15, 60));
    }
    const y0 = H - 2.2 * PX; // top of the shop floor
    for (let f = 0; f < floors; f++) {
      const fy = y0 - (f + 1) * 1.3 * PX;
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, fy + 1.3 * PX - 6, W, 6); // slab line
      for (let k = 0; k < cols; k++) {
        const wx = .25 * PX + k * 1.15 * PX + .2 * PX;
        windowAt(g, wx, fy + .32 * PX, .75 * PX, .78 * PX, frame);
        const sg = g.createLinearGradient(0, fy + 1.1 * PX, 0, fy + 1.3 * PX + 40); // rain streaks
        sg.addColorStop(0, 'rgba(60,50,40,.22)'); sg.addColorStop(1, 'rgba(60,50,40,0)');
        g.fillStyle = sg; g.fillRect(wx + rnd(0, 20), fy + 1.1 * PX, rnd(8, 22), 60);
      }
    }
    // parapet
    g.fillStyle = shade(base, .85); g.fillRect(0, 0, W, .35 * PX);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, .35 * PX - 4, W, 4);
    // ground floor: signboard band and shop
    const shop = pick(SHOPS);
    signboard(g, 6, y0 + 6, W - 12, .62 * PX, shop);
    shopFront(g, 12, y0 + .78 * PX, W - 24, H - y0 - .78 * PX);
    // dirt near the ground
    const dg = g.createLinearGradient(0, H - 40, 0, H);
    dg.addColorStop(0, 'rgba(80,65,45,0)'); dg.addColorStop(1, 'rgba(80,65,45,.45)');
    g.fillStyle = dg; g.fillRect(0, H - 40, W, 40);
    if (Math.random() < .6) { // posters
      for (let i = 0; i < 3; i++) {
        g.fillStyle = pick(['#fff176', '#ef5350', '#4fc3f7', '#ffffff']);
        g.fillRect(rnd(0, W - 30), y0 - rnd(10, 40), 22, 30);
      }
    }
    grain(g, W, H, .12, W * H / 30);
    return { map: tex(c), w: wU, h: hU, base, frame };
  }

  function plaster(color) {
    const [c, g] = canvas(128, 128);
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '80,70,50'},${rnd(.04, .12)})`;
      g.fillRect(rnd(0, 128), rnd(0, 128), rnd(10, 50), rnd(10, 50));
    }
    grain(g, 128, 128, .14, 2500);
    return tex(c);
  }

  // ---------- vehicles ----------
  function busSide(color) {
    const W = 512, H = 192, [c, g] = canvas(W, H);
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 118, W, 16);
    g.fillStyle = shade(color, .7); g.fillRect(0, 134, W, 6);
    for (let i = 0; i < 9; i++) { // windows
      const x = 24 + i * 53;
      const gl = g.createLinearGradient(0, 22, 0, 98);
      gl.addColorStop(0, '#a8c8de'); gl.addColorStop(.5, '#3a5268'); gl.addColorStop(1, '#1e2b38');
      g.fillStyle = '#222'; g.fillRect(x - 2, 20, 50, 80);
      g.fillStyle = gl; g.fillRect(x, 22, 46, 76);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 4, 24, 8, 70);
      g.fillStyle = '#222'; g.fillRect(x, 58, 46, 3);
      if (Math.random() < .5) { g.fillStyle = '#c68a5c'; g.beginPath(); g.arc(x + 24, 52, 9, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + 24, 47, 9, Math.PI, 0); g.fill(); }
    }
    g.fillStyle = '#ffffff'; g.font = `bold 20px ${DEVA}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('राज्य परिवहन', 18, 160);
    g.font = `bold 15px ${SANS}`; g.fillText('STATE TRANSPORT', 200, 160);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, H - 14, W, 14);
    grain(g, W, H, .14, 9000);
    return tex(c);
  }
  function busFront(color, dest) {
    const W = 192, H = 192, [c, g] = canvas(W, H);
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.fillStyle = '#111'; g.fillRect(14, 8, W - 28, 24);
    g.fillStyle = '#ffb300'; g.font = `bold 18px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(dest, W / 2, 21);
    const gl = g.createLinearGradient(0, 36, 0, 110);
    gl.addColorStop(0, '#b6d3e6'); gl.addColorStop(1, '#2c4152');
    g.fillStyle = '#1a1a1a'; g.fillRect(8, 36, W - 16, 78);
    g.fillStyle = gl; g.fillRect(12, 40, W - 24, 70);
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 128, W, 12);
    g.fillStyle = '#2b2b2b'; g.fillRect(50, 150, W - 100, 22);
    g.fillStyle = '#fff'; g.fillRect(70, 176, W - 140, 12);
    g.fillStyle = '#111'; g.font = `bold 10px ${SANS}`; g.fillText('UP 32 AT 4471', W / 2, 182);
    grain(g, W, H, .14, 3000);
    return tex(c);
  }
  function plate(text) {
    const [c, g] = canvas(128, 40);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 40);
    g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 36);
    g.fillStyle = '#111'; g.font = `bold 20px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 21);
    return tex(c);
  }
  function stripes(a, b, n = 6, diag = true) {
    const [c, g] = canvas(128, 64);
    g.fillStyle = a; g.fillRect(0, 0, 128, 64);
    g.fillStyle = b;
    for (let i = -2; i < n * 2; i += 2) {
      g.beginPath();
      const s = 128 / n;
      if (diag) { g.moveTo(i * s, 64); g.lineTo(i * s + s, 64); g.lineTo(i * s + s + 64, 0); g.lineTo(i * s + 64, 0); }
      else { g.rect(i * s / 2, 0, s / 2, 64); }
      g.fill();
    }
    grain(g, 128, 64, .15, 600);
    return tex(c);
  }
  function barricade() {
    const [c, g] = canvas(256, 64);
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#111';
    for (let i = -1; i < 9; i++) { g.beginPath(); g.moveTo(i * 32, 64); g.lineTo(i * 32 + 16, 64); g.lineTo(i * 32 + 48, 0); g.lineTo(i * 32 + 32, 0); g.fill(); }
    g.fillStyle = '#fff'; g.fillRect(70, 14, 116, 36);
    g.fillStyle = '#c62828'; g.font = `bold 22px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('POLICE', 128, 33);
    grain(g, 256, 64, .2, 1500);
    return tex(c);
  }
  function wood() {
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#9a6b42'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(${Math.random() < .5 ? '60,35,15' : '190,140,90'},${rnd(.05, .25)})`; g.fillRect(0, y, 128, 1); }
    g.fillStyle = 'rgba(40,25,10,.5)'; for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 2);
    return tex(c);
  }
  function coinFace() {
    const S = 128, [c, g] = canvas(S, S);
    const gr = g.createRadialGradient(50, 45, 8, 64, 64, 64);
    gr.addColorStop(0, '#fff2a8'); gr.addColorStop(.6, '#f2b600'); gr.addColorStop(1, '#a86b00');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(120,70,0,.7)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
    g.fillStyle = 'rgba(120,70,0,.85)'; g.font = `bold 70px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('₹', 66, 68);
    g.fillStyle = 'rgba(255,250,210,.9)'; g.fillText('₹', 62, 64);
    return tex(c);
  }
  // a palm frond with transparent background
  function frond() {
    const [c, g] = canvas(64, 256);
    g.strokeStyle = '#6d5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
    for (let y = 8; y < 250; y += 5) {
      const len = 30 * Math.sin(Math.PI * y / 256) + 4;
      g.strokeStyle = `rgb(${50 + Math.random() * 30},${110 + Math.random() * 40},${40 + Math.random() * 20})`;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(32, y); g.lineTo(32 - len, y + 10); g.stroke();
      g.beginPath(); g.moveTo(32, y); g.lineTo(32 + len, y + 10); g.stroke();
    }
    const t = tex(c); return t;
  }
  function flagTex(colors) {
    const [c, g] = canvas(96, 64);
    colors.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 64 / colors.length, 96, 64 / colors.length + 1); });
    if (colors.length === 3) { // Ashoka chakra
      g.strokeStyle = '#1a237e'; g.lineWidth = 1.5; g.beginPath(); g.arc(48, 32, 8, 0, 7); g.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(48, 32); g.lineTo(48 + Math.cos(a) * 8, 32 + Math.sin(a) * 8); g.stroke(); }
    }
    return tex(c);
  }
  function grille() {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#e8e8e4'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#555'; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill();
    g.strokeStyle = '#ddd'; g.lineWidth = 1.5;
    for (let r = 6; r < 24; r += 4) { g.beginPath(); g.arc(32, 32, r, 0, 7); g.stroke(); }
    return tex(c);
  }

  return { asphalt, paving, kerb, dust, facade, plaster, busSide, busFront, plate, stripes, barricade, wood, coinFace, frond, flagTex, grille, pick, rnd };
})();
