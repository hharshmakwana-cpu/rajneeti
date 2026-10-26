// RAJNEETI — sound effects and music, synthesised with Web Audio so the game
// needs no audio files and keeps working offline.

const Sound = (() => {
  const KEY = 'rajneeti.sound';
  const settings = { sfx: .8, music: .45, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }

  let ctx = null, sfxBus = null, musicBus = null, verb = null, noiseBuf = null;
  let mode = 'title', step = 0, nextAt = 0;

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ } }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx, t, .03);
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * .55, t, .15);
  }

  // A short synthetic room so sounds feel less "beepy".
  function makeReverb() {
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .22;
    conv.connect(wet); wet.connect(ctx.destination);
    return conv;
  }

  // Browsers only allow audio after the player touches the screen.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      verb = makeReverb();
      sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination); sfxBus.connect(verb);
      musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
      nextAt = ctx.currentTime + .1;
      setInterval(schedule, 120);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

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

  function noise(dur, { vol = .3, at = 0, type = 'bandpass', freq = 1000, to = null, q = 1, bus = sfxBus, attack = .005 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, vol, attack, dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random()); src.stop(t + dur + .05);
  }

  // dhol-like drums for music and effects
  const kick = (at, vol = .5, bus = sfxBus) => tone(140, .25, { at, vol, to: 45, bus });
  const tak = (at, vol = .25, bus = sfxBus) => noise(.07, { at, vol, freq: 2500, q: 2, bus });
  const bell = (f, at = 0, vol = .2) => [1, 2.76, 5.4].forEach((m, i) => tone(f * m, 1.2 / (i + 1), { at, vol: vol / (i + 1) }));

  const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5 };

  const SFX = {
    tap: () => { tone(900, .07, { vol: .16, to: 380 }); },
    deal: () => [0, .06, .12].forEach(at => noise(.09, { at, vol: .18, freq: 1800, to: 4000, q: .8 })),
    flip: () => { noise(.12, { vol: .2, freq: 900, to: 3000 }); tone(500, .1, { type: 'triangle', vol: .08, at: .05, to: 900 }); },
    swipe: () => noise(.28, { vol: .35, freq: 500, to: 4500, q: .7 }),
    good: () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, .25, { type: 'triangle', vol: .2, at: i * .06 })); tone(N.C6 * 2, .4, { vol: .05, at: .24 }); },
    bad: () => { tone(220, .32, { type: 'sawtooth', vol: .14, to: 180, lp: 900 }); tone(196, .5, { type: 'sawtooth', vol: .14, at: .3, to: 140, lp: 900 }); },
    coin: () => [0, .07, .14, .21].forEach((at, i) => { tone(1300 + i * 220, .09, { type: 'square', vol: .06, at }); tone(2600 + i * 300, .12, { vol: .05, at: at + .03 }); }),
    cheer: () => {
      noise(1.4, { vol: .35, freq: 900, q: .6, attack: .25 });
      noise(1.2, { vol: .2, freq: 2200, q: 1.5, attack: .2, at: .05 });
      [0, .25, .5].forEach(at => kick(at, .35));
      tone(1800, .35, { vol: .05, at: .3, to: 2600 }); tone(2000, .3, { vol: .04, at: .6, to: 2900 });
    },
    drumroll: () => { for (let i = 0; i < 16; i++) tak(i * .05, .08 + i * .012); },
    stamp: () => { tone(160, .3, { vol: .5, to: 50 }); noise(.12, { vol: .3, freq: 600, q: .5 }); },
    news: () => { bell(N.A5, 0, .16); bell(N.E5, .18, .16); },
    alarm: () => [0, .3].forEach(at => tone(700, .28, { type: 'square', vol: .07, at, to: 1100, lp: 2500 })),
    sword: () => { noise(.25, { vol: .3, freq: 5000, to: 1500, q: 4 }); tone(1200, .4, { type: 'triangle', vol: .08, to: 1500 }); },
    tv: () => [N.C5, N.G5, N.E5, N.C6].forEach((f, i) => tone(f, .14, { type: 'square', vol: .06, at: i * .1, lp: 3000 })),
    whoosh: () => noise(.5, { vol: .3, freq: 300, to: 3000, q: .6, attack: .2 }),
    tick: () => tone(1700, .04, { vol: .1, to: 1200 }),
    up: () => [0, .05, .1].forEach((at, i) => tone(600 + i * 200, .1, { type: 'triangle', vol: .12, at })),
    down: () => [0, .07, .14].forEach((at, i) => tone(500 - i * 90, .12, { type: 'triangle', vol: .12, at })),
    win: () => {
      const brass = (f, at, dur) => tone(f, dur, { type: 'sawtooth', vol: .1, at, lp: 2200, attack: .03 });
      [[N.C4, N.E4, N.G4], [N.C4, N.E4, N.G4], [N.D4, N.G4, 493.88], [N.E4, N.G4, N.C5]].forEach((ch, i) => ch.forEach(f => brass(f * 2, i * .18, i === 3 ? 1.2 : .16)));
      [0, .18, .36, .54].forEach(at => kick(at, .45));
      for (let i = 0; i < 8; i++) tak(.54 + i * .07, .15);
      [N.C6, N.E5 * 2, N.G5 * 2].forEach((f, i) => tone(f, .6, { vol: .05, at: .6 + i * .08 }));
    },
    lose: () => [N.G4, 369.99, N.E4, 311.13].forEach((f, i) => tone(f, i === 3 ? .9 : .3, { type: 'sawtooth', vol: .1, at: i * .3, lp: 1200, to: i === 3 ? f * .9 : null })),
  };

  function play(name) {
    if (!ctx || settings.muted || !settings.sfx || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* audio node limits on old devices */ }
  }

  // ---- music: a loop per game mode, scheduled slightly ahead ----
  const SCALE = [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5, N.D5, N.E5, N.G5, N.A5];
  const SONGS = {
    title: { bpm: 92, mel: [5, -1, 4, 3, 4, -1, 2, -1, 3, 4, 5, 7, 6, -1, 5, -1], drum: 'x...t...x.x.t...', bass: [0, 0, 3, 3] },
    campaign: { bpm: 118, mel: [5, 5, 7, 5, 4, 3, 4, -1, 2, 3, 4, 5, 4, 3, 2, -1, 5, 7, 8, 7, 5, 4, 5, -1, 4, 3, 2, 3, 0, -1, 0, -1], drum: 'x.tx.tx.x.tx.tt.', bass: [0, 0, 4, 3] },
    gov: { bpm: 100, mel: [2, -1, 4, -1, 5, 4, 3, -1, 2, -1, 3, 4, 2, -1, 0, -1], drum: 'x...t.x.x...t...', bass: [0, 3, 4, 3] },
    tense: { bpm: 132, mel: [0, -1, 0, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1, -1, -1], drum: 'xtttxtttxtttxttt', bass: [0, 0, 0, 1] },
  };

  function schedule() {
    if (!ctx) return;
    const song = SONGS[mode];
    if (!song || document.hidden || settings.muted || !settings.music) { nextAt = ctx.currentTime + .1; return; }
    const beat = 60 / song.bpm / 2; // eighth notes
    while (nextAt < ctx.currentTime + .5) {
      const at = Math.max(0, nextAt - ctx.currentTime);
      const n = song.mel[step % song.mel.length];
      if (n >= 0) {
        tone(SCALE[n], beat * 1.8, { type: 'triangle', vol: .1, at, bus: musicBus, attack: .01 });
        tone(SCALE[n] * 2, beat * .9, { vol: .025, at, bus: musicBus });
      }
      const d = song.drum[step % 16];
      if (d === 'x') kick(at, .28, musicBus);
      if (d === 't') tak(at, .07, musicBus);
      if (step % 8 === 0) {
        const root = SCALE[song.bass[(step / 8 | 0) % song.bass.length]] / 2;
        tone(root, beat * 7, { type: 'sawtooth', vol: .05, at, bus: musicBus, lp: 500, attack: .05 });
        tone(root * 1.5, beat * 7, { vol: .03, at, bus: musicBus, attack: .2 });
      }
      step++; nextAt += beat;
    }
  }

  return {
    unlock, play,
    music(m) { if (m !== mode) { mode = m; step = 0; } },
    get settings() { return settings; },
    set(k, v) { settings[k] = v; applyVolumes(); persist(); },
    toggleMute() { settings.muted = !settings.muted; applyVolumes(); persist(); return settings.muted; },
  };
})();
