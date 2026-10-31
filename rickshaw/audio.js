// RICKSHAW RUSH — soft, gentle sound made with Web Audio (no files, works offline).
// Everything runs through a low-pass filter and a compressor so nothing is shrill
// or loud. Music: santoor and bansuri (flute) over a soft tabla groove, in Raag
// Bhupali. Effects: bell-like coins, an auto-rickshaw "peep-peep" horn.

const Sound = (() => {
  const KEY = 'rickshawrush.sound.v2';
  const settings = { sfx: .5, music: .35, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }

  let ctx = null, master, sfxBus, musicBus, echo, noiseBuf, keepAlive = null, engine = null;
  let mode = 'title', step = 0, nextAt = 0;

  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ } };
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx * .8, t, .05);
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * .6, t, .2);
    if (keepAlive) keepAlive.muted = settings.muted;
  }

  // iPhones silence Web Audio in silent mode unless a media element is playing.
  function silentClip() {
    const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // master: gentle low-pass + compressor keep the mix warm and never loud
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .25;
      const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 6500; warm.Q.value = .5;
      master = ctx.createGain(); master.gain.value = .8;
      warm.connect(comp); comp.connect(master); master.connect(ctx.destination);
      sfxBus = ctx.createGain(); musicBus = ctx.createGain();
      sfxBus.connect(warm); musicBus.connect(warm);
      // a soft stereo-ish echo for the melody instruments
      echo = ctx.createDelay(1); echo.delayTime.value = .33;
      const fb = ctx.createGain(); fb.gain.value = .28;
      const eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 2200;
      const eOut = ctx.createGain(); eOut.gain.value = .35;
      echo.connect(eLp); eLp.connect(fb); fb.connect(echo); eLp.connect(eOut); eOut.connect(musicBus);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      try { keepAlive = new Audio(silentClip()); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); } catch (e) { keepAlive = null; }
      applyVolumes();
      nextAt = ctx.currentTime + .2;
      setInterval(schedule, 100);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume(); });
    }
    if (ctx.state !== 'running') ctx.resume();
    if (keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
  }

  // ---------- instruments ----------
  function voice(freq, dur, { type = 'sine', vol = .1, at = 0, to = null, attack = .005, bus = sfxBus, lp = 0, send = 0 } = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let n = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); n = f; }
    n.connect(g); g.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(echo); }
    o.start(t); o.stop(t + dur + .05);
  }
  function hiss(dur, { vol = .05, at = 0, freq = 1200, to = null, q = .8, type = 'bandpass', attack = .01, bus = sfxBus } = {}) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  // santoor: a struck, shimmering string (two slightly detuned partials)
  const santoor = (f, at, vol = .06, bus = musicBus) => {
    voice(f, 1.4, { at, vol, type: 'triangle', lp: 2600, bus, send: .5 });
    voice(f * 2.005, .7, { at, vol: vol * .35, bus, send: .3 });
    voice(f * 1.003, 1.2, { at, vol: vol * .5, bus });
  };
  // bansuri: breathy bamboo flute with a slow vibrato
  function flute(f, dur, at, vol = .05) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * .985, t); o.frequency.exponentialRampToValueAtTime(f, t + .08);
    lfo.frequency.value = 5; lg.gain.value = f * .006; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .09); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(musicBus);
    const s = ctx.createGain(); s.gain.value = .6; g.connect(s); s.connect(echo);
    o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
    hiss(dur * .8, { at, vol: vol * .25, freq: f * 2, q: 6, bus: musicBus, attack: .06 });
  }
  // soft tabla: bayan (deep, bending) and dayan (ringing)
  const bayan = (at, vol = .12) => voice(85, .35, { at, vol, to: 62, bus: musicBus });
  const dayan = (at, vol = .05) => { voice(620, .18, { at, vol, bus: musicBus }); voice(1240, .06, { at, vol: vol * .3, bus: musicBus }); };
  const shaker = (at, vol = .012) => hiss(.06, { at, vol, freq: 7000, type: 'highpass', q: .5, bus: musicBus });
  const bass = (f, at, dur, vol = .07) => voice(f, dur, { at, vol, type: 'triangle', lp: 400, attack: .02, bus: musicBus });
  const pad = (fs, at, dur, vol = .012) => fs.forEach(f => { voice(f, dur, { at, vol, type: 'sawtooth', lp: 900, attack: .5, bus: musicBus }); });

  // notes of Raag Bhupali (Sa Re Ga Pa Dha), Sa = D4
  const SA = 293.66, n = s => SA * Math.pow(2, s / 12);
  const BHUP = [0, 2, 4, 7, 9];
  const deg = k => n(BHUP[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5));

  // ---------- effects ----------
  const SFX = {
    tap: () => voice(880, .07, { vol: .04 }),
    tick: () => voice(1200, .05, { vol: .025 }),
    coin: () => { voice(n(19), .35, { vol: .045 }); voice(n(24), .45, { at: .06, vol: .04 }); },
    pop: () => { const k = 10 + Math.floor(Math.random() * 3); voice(deg(k), .3, { vol: .04 }); voice(deg(k) * 2, .2, { vol: .015 }); },
    swipe: () => hiss(.18, { vol: .04, freq: 600, to: 1800, q: .6 }),
    whoosh: () => { hiss(.35, { vol: .05, freq: 400, to: 1600, q: .5, attack: .05 }); voice(300, .25, { vol: .03, to: 520 }); },
    count: () => voice(n(12), .25, { vol: .05, type: 'triangle' }),
    go: () => [0, 2, 4, 5].forEach((k, i) => santoor(deg(k + 5), i * .07, .06, sfxBus)),
    good: () => [0, 1, 2, 3, 4].forEach((k, i) => santoor(deg(k + 5), i * .06, .05, sfxBus)),
    win: () => { [0, 1, 2, 3, 4, 5, 7].forEach((k, i) => santoor(deg(k + 5), i * .09, .055, sfxBus)); voice(n(24), 1.2, { at: .6, vol: .03 }); voice(n(31), 1.2, { at: .66, vol: .02 }); },
    oops: () => voice(220, .18, { vol: .04, type: 'triangle', to: 180 }),
    bad: () => [4, 3, 1, 0].forEach((k, i) => voice(deg(k + 5), .3, { at: .2 + i * .12, vol: .035, type: 'triangle' })),
    stamp: () => { voice(120, .35, { vol: .16, to: 45 }); hiss(.25, { vol: .07, freq: 500, q: .6, type: 'lowpass' }); hiss(.4, { vol: .03, freq: 2500, q: 1, at: .03 }); },
    smash: () => { voice(160, .2, { vol: .1, to: 60 }); hiss(.3, { vol: .05, freq: 1500, q: .7 }); },
    // the classic auto-rickshaw bulb horn: two short reedy "peep"s
    bus: () => [0, .2].forEach(at => { voice(410, .14, { at, vol: .05, type: 'square', lp: 1400 }); voice(415, .14, { at, vol: .03, type: 'sawtooth', lp: 1100 }); }),
  };
  function play(name) {
    if (!ctx || settings.muted || !settings.sfx || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* too many voices on old phones */ }
  }

  // Quiet two-stroke engine "putt-putt" while driving; pitch follows speed.
  function setEngine(on, speed = 14) {
    if (!ctx) return;
    if (on && !engine) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), am = ctx.createOscillator(), amG = ctx.createGain(), g = ctx.createGain();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 260;
      am.type = 'square'; amG.gain.value = .5; g.gain.value = 0;
      const vca = ctx.createGain(); vca.gain.value = .5;
      am.connect(amG); amG.connect(vca.gain);
      o.connect(lp); lp.connect(vca); vca.connect(g); g.connect(sfxBus);
      o.start(); am.start();
      engine = { o, am, g };
    }
    if (!engine) return;
    const t = ctx.currentTime;
    engine.g.gain.setTargetAtTime(on ? .05 : 0, t, .3);
    engine.o.frequency.setTargetAtTime(45 + speed * 1.2, t, .3);
    engine.am.frequency.setTargetAtTime(9 + speed * .5, t, .3);
  }

  // ---------- music ----------
  const SONGS = {
    // calm: santoor phrases over a drone, like an evening street
    title: {
      stepDur: .42, len: 32,
      play(s, at) {
        if (s % 16 === 0) pad([n(-12), n(-5), n(0)], at, 6.6);
        if (s % 8 === 0) bass(n(-24), at, 3);
        const mel = [5, null, 7, 6, null, 5, 4, null, 5, null, 3, null, 2, null, null, null, 4, 5, null, 7, null, 8, 7, null, 6, null, 5, 4, 2, null, 0, null];
        const k = mel[s % 32];
        if (k != null) santoor(deg(k), at, .05);
        if (s % 4 === 2) dayan(at, .02);
      },
    },
    // driving: a light, bouncy groove (dadra-like) with flute calls
    run: {
      stepDur: .15, len: 128,
      play(s, at) {
        const k = s % 8, bar = Math.floor(s / 8) % 16;
        if (k === 0 || k === 5) bayan(at, k === 0 ? .1 : .07);
        if (k === 2 || k === 4 || k === 6) dayan(at, k === 4 ? .045 : .03);
        if (k % 2 === 1) shaker(at);
        const roots = [0, 0, 3, 3, 4, 4, 2, 2, 0, 0, 3, 3, 4, 2, 0, 0];
        if (k === 0) bass(deg(roots[bar] - 5) / 2, at, .55);
        if (k === 4) bass(deg(roots[bar] - 3) / 2, at, .4, .05);
        if (bar % 8 < 4) { // santoor riff
          const riff = [5, null, 7, 6, 5, null, 4, 5];
          const r = riff[k]; if (r != null && (bar % 2 === 0 || k < 4)) santoor(deg(r + (bar % 4 === 3 ? 1 : 0)), at, .04);
        } else if (k === 0) { // flute phrase
          const ph = [[9, .55], [8, .3], [7, .9], [5, .6]][bar % 4];
          flute(deg(ph[0]), ph[1] + .3, at, .045);
        }
      },
    },
  };
  SONGS.campaign = SONGS.run;

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
    unlock, play, engine: setEngine,
    get ready() { return !!ctx && ctx.state === 'running'; },
    music(m) { if (m !== mode) { mode = m; step = 0; } },
    get settings() { return settings; },
    set(k, v) { settings[k] = v; applyVolumes(); persist(); },
    toggleMute() { settings.muted = !settings.muted; applyVolumes(); persist(); return settings.muted; },
  };
})();
