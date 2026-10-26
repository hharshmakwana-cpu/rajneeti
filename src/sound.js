// RAJNEETI — Indian-style sound and music, synthesised with Web Audio so the
// game needs no audio files and keeps working offline.
// Instruments: dhol, dholak/tabla, manjira, tumbi and sitar (plucked strings),
// shehnai, harmonium and tanpura drone. Rally chants use the device's voice.

const Sound = (() => {
  const KEY = 'rajneeti.sound';
  const settings = { sfx: .85, music: .7, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }

  let ctx = null, sfxBus = null, musicBus = null, verb = null, noiseBuf = null, keepAlive = null;
  let mode = 'title', step = 0, nextAt = 0;
  const plucks = new Map();

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ } }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx, t, .03);
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * .9, t, .15);
    if (keepAlive) keepAlive.muted = settings.muted;
  }

  function makeReverb() {
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .25;
    conv.connect(wet); wet.connect(ctx.destination);
    return conv;
  }

  // iPhones silence Web Audio in silent mode unless a media element is playing,
  // so loop an inaudible clip once sound is unlocked.
  function silentClip() {
    const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  // Browsers only allow audio after the player touches the screen.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      verb = makeReverb();
      sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination); sfxBus.connect(verb);
      musicBus = ctx.createGain(); musicBus.connect(ctx.destination); musicBus.connect(verb);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      try { keepAlive = new Audio(silentClip()); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); } catch (e) { keepAlive = null; }
      applyVolumes();
      nextAt = ctx.currentTime + .15;
      setInterval(schedule, 100);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume(); });
    }
    if (ctx.state !== 'running') ctx.resume();
    if (keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
  }

  // ---------- building blocks ----------
  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  }

  function tone(freq, dur, { type = 'sine', vol = .3, at = 0, to = null, bus = sfxBus, attack = .008, lp = null } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, vol, attack, dur);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + .05);
  }

  function noise(dur, { vol = .3, at = 0, type = 'bandpass', freq = 1000, to = null, q = 1, bus = sfxBus, attack = .004 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, vol, attack, dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random()); src.stop(t + dur + .05);
  }

  // Plucked string (Karplus–Strong): tumbi when bright, sitar when buzzy.
  function pluckBuffer(freq, bright) {
    const key = Math.round(freq) + (bright ? 'b' : 's');
    if (plucks.has(key)) return plucks.get(key);
    const sr = ctx.sampleRate, len = Math.floor(sr * (bright ? .9 : 1.8)), p = Math.max(2, Math.round(sr / freq));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < p; i++) d[i] = Math.random() * 2 - 1;
    const decay = bright ? .994 : .997;
    for (let i = p; i < len; i++) {
      const v = decay * .5 * (d[i - p] + d[i - p + 1 < i ? i - p + 1 : i - p]);
      d[i] = bright ? v : Math.tanh(v * 1.6) * .8; // a little jawari buzz for the sitar
    }
    plucks.set(key, buf);
    return buf;
  }
  function pluck(freq, { at = 0, vol = .4, bright = true, bus = musicBus } = {}) {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = pluckBuffer(freq, bright);
    g.gain.value = vol;
    src.connect(g); g.connect(bus);
    src.start(ctx.currentTime + at);
  }

  // Shehnai: a nasal double-reed with vibrato and a slide (meend) into the note.
  function shehnai(freq, dur, { at = 0, vol = .1, from = null, bus = musicBus } = {}) {
    const t = ctx.currentTime + at;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    const bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    [o1, o2].forEach(o => {
      if (from) { o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(freq, t + Math.min(.18, dur * .4)); }
      else o.frequency.setValueAtTime(freq, t);
    });
    o2.detune.value = 7;
    lfo.frequency.value = 5.5; lg.gain.value = freq * .012;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.4;
    lp.type = 'lowpass'; lp.frequency.value = 3800;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .05);
    g.gain.setValueAtTime(vol, t + dur * .8);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o1.connect(bp); o2.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus);
    [o1, o2, lfo].forEach(o => { o.start(t); o.stop(t + dur + .05); });
  }

  // Harmonium: reedy chord with a slow swell.
  function harmonium(freqs, dur, { at = 0, vol = .035 } = {}) {
    for (const f of freqs) for (const d of [-4, 4]) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f; o.detune.value = d;
      lp.type = 'lowpass'; lp.frequency.value = 1600;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .12);
      g.gain.setValueAtTime(vol, t + dur - .1); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(lp); lp.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + .05);
    }
  }

  // Drums: dhol has a deep bass head (dagga) and a sharp stick side (tilli).
  const dholBass = (at, vol = .55, bus = musicBus) => { tone(95, .38, { at, vol, to: 52, bus }); noise(.05, { at, vol: vol * .25, freq: 300, q: .7, bus }); };
  const dholTilli = (at, vol = .22, bus = musicBus) => { noise(.05, { at, vol, freq: 3200, q: 1.5, bus }); tone(540, .05, { at, vol: vol * .5, type: 'triangle', bus }); };
  const tablaDha = (at, vol = .3) => { tone(110, .3, { at, vol, to: 80, bus: musicBus }); tone(520, .5, { at, vol: vol * .4, bus: musicBus }); };
  const tablaNa = (at, vol = .22) => { tone(520, .35, { at, vol, bus: musicBus }); tone(1560, .12, { at, vol: vol * .3, bus: musicBus }); };
  const tablaGe = (at, vol = .3) => tone(120, .22, { at, vol, to: 70, bus: musicBus });
  const manjira = (at, vol = .06) => { tone(3520, .45, { at, vol, bus: musicBus }); tone(5280, .3, { at, vol: vol * .6, bus: musicBus }); };
  // a crowd "Hoy!" shout, as in bhangra
  const hoy = (at, vol = .1) => { tone(240, .2, { at, vol, type: 'sawtooth', to: 190, lp: 1200, bus: musicBus }); noise(.18, { at, vol: vol * .8, freq: 900, q: 3, bus: musicBus }); };

  // ---------- note names (Sa = C4) ----------
  const SA = 261.63;
  const r = n => SA * Math.pow(2, n / 12); // semitones from Sa

  // ---------- sound effects ----------
  const SFX = {
    tap: () => { tablaNa(0, .12); },
    pop: () => { tone(700, .08, { vol: .2, to: 1300 }); tablaNa(0, .1); },
    oops: () => { tone(300, .2, { type: 'sawtooth', vol: .1, to: 150, lp: 900 }); },
    deal: () => [0, .07, .14].forEach(at => noise(.08, { at, vol: .16, freq: 1800, to: 4000, q: .8 })),
    flip: () => { noise(.12, { vol: .18, freq: 900, to: 3000 }); },
    swipe: () => noise(.28, { vol: .3, freq: 500, to: 4500, q: .7 }),
    good: () => { [0, 4, 7, 12].forEach((n, i) => pluck(r(n + 12), { at: i * .06, vol: .5, bus: sfxBus })); manjira(.25, .08); },
    bad: () => { shehnai(r(3), .35, { vol: .12, bus: sfxBus }); shehnai(r(1), .6, { at: .3, vol: .12, from: r(3), bus: sfxBus }); },
    coin: () => [0, .07, .14, .21].forEach((at, i) => { tone(1300 + i * 220, .09, { type: 'square', vol: .05, at }); tone(2600 + i * 300, .12, { vol: .05, at: at + .03 }); }),
    cheer: () => {
      noise(1.5, { vol: .32, freq: 900, q: .6, attack: .25 });
      noise(1.3, { vol: .18, freq: 2200, q: 1.5, attack: .2, at: .05 });
      [0, .22, .44, .66].forEach((at, i) => { dholBass(at, .5, sfxBus); dholTilli(at + .11, .2, sfxBus); if (i % 2) hoy(at, .12); });
    },
    drumroll: () => { for (let i = 0; i < 18; i++) dholTilli(i * .045, .06 + i * .012, sfxBus); dholBass(.85, .6, sfxBus); },
    stamp: () => { tone(160, .3, { vol: .5, to: 50 }); noise(.12, { vol: .3, freq: 600, q: .5 }); },
    news: () => { manjira(0, .12); manjira(.18, .12); },
    alarm: () => { shehnai(r(12), .25, { vol: .14, bus: sfxBus }); shehnai(r(13), .25, { at: .25, vol: .14, bus: sfxBus }); shehnai(r(12), .4, { at: .5, vol: .14, bus: sfxBus }); },
    sword: () => { noise(.25, { vol: .3, freq: 5000, to: 1500, q: 4 }); tone(1200, .4, { type: 'triangle', vol: .08, to: 1500 }); },
    tv: () => [0, 4, 7, 12].forEach((n, i) => shehnai(r(n + 12), .14, { at: i * .1, vol: .08, bus: sfxBus })),
    bus: () => { tone(392, .22, { type: 'square', vol: .07, lp: 1800 }); tone(330, .3, { type: 'square', vol: .07, at: .25, lp: 1800 }); noise(.7, { vol: .1, type: 'lowpass', freq: 300, at: .1, attack: .2 }); },
    plane: () => { noise(1.1, { vol: .3, freq: 400, to: 2400, q: .8, attack: .4 }); tone(180, 1, { type: 'sawtooth', vol: .03, to: 260, lp: 900 }); },
    whoosh: () => noise(.5, { vol: .28, freq: 300, to: 3000, q: .6, attack: .2 }),
    tick: () => tablaNa(0, .1),
    count: () => { tone(880, .06, { vol: .12 }); },
    go: () => { dholBass(0, .6, sfxBus); hoy(0, .2); },
    up: () => [0, 4, 7].forEach((n, i) => pluck(r(n + 12), { at: i * .05, vol: .45, bus: sfxBus })),
    down: () => [7, 4, 0].forEach((n, i) => pluck(r(n), { at: i * .07, vol: .45, bus: sfxBus, bright: false })),
    win: () => {
      // shehnai fanfare over a dhol burst, like a victory procession
      [[0, .18], [4, .18], [7, .18], [12, .9]].forEach(([n, d], i) => shehnai(r(n + 12), d + .05, { at: i * .17, vol: .13, from: i ? r(n + 10) : null, bus: sfxBus }));
      for (let i = 0; i < 8; i++) { dholBass(i * .17, .5, sfxBus); dholTilli(i * .17 + .085, .22, sfxBus); }
      hoy(.68, .2); hoy(1.02, .2);
      for (let i = 0; i < 6; i++) manjira(.7 + i * .1, .08);
    },
    lose: () => [7, 6, 3, 2].forEach((n, i) => shehnai(r(n), i === 3 ? .9 : .3, { at: i * .3, vol: .1, from: i ? r(n + 1) : null, bus: sfxBus })),
  };

  function play(name) {
    if (!ctx || settings.muted || !settings.sfx || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* audio node limits on old devices */ }
  }

  // Rally chant with the device's own voice ("… Zindabad!").
  function chant(text) {
    if (settings.muted || !settings.sfx || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find(x => /hi[-_]IN/i.test(x.lang)) || speechSynthesis.getVoices().find(x => /en[-_]IN/i.test(x.lang));
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'hi-IN'; u.rate = 1.05; u.pitch = 1.1; u.volume = Math.min(1, settings.sfx + .1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }

  // ---------- music ----------
  // Each mode plays a step of a looping arrangement; steps are scheduled ~0.5 s ahead.
  const SONGS = {
    // Title: shehnai alaap in Raag Yaman over a tanpura drone, slow and auspicious
    title: {
      stepDur: .5, len: 32,
      play(s, at) {
        if (s % 8 === 0) { pluck(r(-5), { at, vol: .35, bright: false }); pluck(r(0), { at: at + 1, vol: .3, bright: false }); pluck(r(0), { at: at + 2, vol: .3, bright: false }); pluck(r(-12), { at: at + 3, vol: .4, bright: false }); }
        const phrase = { 0: [7, 2, null], 4: [9, 1.4, 11], 7: [11, 1, 9], 9: [12, 3, 11], 16: [14, 1.5, 12], 19: [12, 1, 14], 21: [11, 1, 12], 23: [9, 2, 11], 28: [7, 2, 9] };
        const p = phrase[s];
        if (p) shehnai(r(p[0]), p[1], { at, vol: .075, from: p[2] != null ? r(p[2]) : null });
        if (s % 16 === 12) manjira(at, .04);
      },
    },
    // Campaign: rally bhangra — dhol chaal, tumbi riff, shehnai hook, harmonium, "Hoy!"
    campaign: {
      stepDur: .1, len: 96, // triplet grid: 12 steps per bar, 8 bars
      play(s, at) {
        const b = Math.floor(s / 12) % 8, k = s % 12;
        // dhol chaal: DHA . ti DHA . ti DHA ti ti DHA . ti
        if ([0, 3, 6, 9].includes(k)) dholBass(at, k === 0 ? .55 : .42);
        if ([2, 5, 7, 8, 11].includes(k)) dholTilli(at, .16);
        if (k === 0 || k === 6) manjira(at, .035);
        // harmonium chords: Sa – Ma – Pa – Sa
        if (k === 0) { const root = [0, 5, 7, 0, 0, 5, 7, 7][b]; harmonium([r(root - 12), r(root - 5), r(root)], 1.15, { at }); }
        // tumbi riff on bars 0-3, shehnai hook on bars 4-7
        if (b < 4) {
          const riff = [12, null, 14, 16, null, 14, 12, null, 10, 12, null, null];
          const n = riff[k];
          if (n != null) pluck(r(n + (b === 3 && k > 5 ? -2 : 0)), { at, vol: .3 });
        } else {
          const hook = { 0: [16, .55, 14], 6: [14, .3, null], 9: [12, .5, 14] };
          const lastBar = { 0: [10, .3, 12], 3: [12, .9, 10] };
          const h = (b === 7 ? lastBar : hook)[k];
          if (h) shehnai(r(h[0]), h[1], { at, vol: .09, from: h[2] != null ? r(h[2]) : null });
        }
        if ((b === 3 || b === 7) && k === 9) hoy(at, .09);
      },
    },
    // Governing: sitar in Raag Yaman over a tabla keherwa (Dha Ge Na Ti Na Ka Dhi Na)
    gov: {
      stepDur: .3, len: 64,
      play(s, at) {
        const k = s % 8;
        if (k === 0 || k === 6) tablaDha(at, .22);
        if (k === 1) tablaGe(at, .2);
        if ([2, 4, 7].includes(k)) tablaNa(at, .12);
        if (s % 16 === 0) { pluck(r(-12), { at, vol: .3, bright: false }); pluck(r(-5), { at: at + .6, vol: .25, bright: false }); }
        // phrases move through Yaman: Sa Re Ga Ma# Pa Dha Ni
        const mel = [0, 2, 4, null, 6, 7, null, 9, 11, null, 12, null, 11, 9, 7, null, 6, 4, null, 2, 4, null, 2, 0, null, null, 7, 9, 7, 6, 4, null];
        const n = mel[s % mel.length];
        if (n != null && s % 2 === 0) pluck(r(n), { at, vol: .32, bright: false });
      },
    },
    // Counting day: fast dhol tension with a tanpura drone and a held shehnai
    tense: {
      stepDur: .12, len: 32,
      play(s, at) {
        if (s % 4 === 0) dholBass(at, .45);
        dholTilli(at, .05 + (s % 32) * .004);
        if (s % 16 === 0) { pluck(r(-12), { at, vol: .35, bright: false }); shehnai(r(s % 32 === 0 ? 7 : 8), 1.8, { at, vol: .05 }); }
      },
    },
  };

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const song = SONGS[mode];
    if (!song || document.hidden || settings.muted || !settings.music) { nextAt = ctx.currentTime + .1; return; }
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + .05;
    while (nextAt < ctx.currentTime + .5) {
      try { song.play(step % song.len, nextAt - ctx.currentTime); } catch (e) { /* skip a step on overload */ }
      step++; nextAt += song.stepDur;
    }
  }

  return {
    unlock, play, chant,
    get ready() { return !!ctx && ctx.state === 'running'; },
    music(m) { if (m !== mode) { mode = m; step = 0; } },
    get settings() { return settings; },
    set(k, v) { settings[k] = v; applyVolumes(); persist(); },
    toggleMute() { settings.muted = !settings.muted; applyVolumes(); persist(); if (settings.muted && 'speechSynthesis' in window) speechSynthesis.cancel(); return settings.muted; },
  };
})();
