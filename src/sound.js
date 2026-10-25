// RAJNEETI — sound effects and music, synthesised with Web Audio so the game
// needs no audio files and keeps working offline.

const Sound = (() => {
  const KEY = 'rajneeti.sound';
  const settings = { sfx: .7, music: .4, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }

  let ctx = null, sfxBus = null, musicBus = null, musicTimer = null, step = 0, nextAt = 0;

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ } }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfx, t, .03);
    musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.music * .5, t, .1);
  }

  // Browsers only allow audio after the player touches the screen.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
      applyVolumes();
      startMusic();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, { type = 'sine', vol = .3, at = 0, to = null, bus = sfxBus } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + .02);
  }

  function whoosh(dur = .25, vol = .25) {
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t);
  }

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
  const SFX = {
    tap: () => tone(660, .06, { type: 'triangle', vol: .18 }),
    deal: () => tone(320, .12, { type: 'triangle', vol: .15, to: 640 }),
    good: () => [C5, E5, G5].forEach((f, i) => tone(f, .14, { type: 'triangle', vol: .22, at: i * .07 })),
    bad: () => { tone(392, .18, { type: 'sawtooth', vol: .12 }); tone(311, .3, { type: 'sawtooth', vol: .12, at: .14 }); },
    coin: () => { tone(988, .08, { type: 'square', vol: .1 }); tone(1319, .22, { type: 'square', vol: .1, at: .07 }); },
    swipe: () => whoosh(.22, .3),
    tick: () => tone(1400, .03, { type: 'square', vol: .05 }),
    news: () => { tone(880, .14, { type: 'triangle', vol: .2 }); tone(660, .2, { type: 'triangle', vol: .2, at: .13 }); },
    win: () => { [C5, E5, G5, C6].forEach((f, i) => tone(f, i === 3 ? .7 : .16, { type: 'triangle', vol: .25, at: i * .13 })); tone(C5 / 2, .9, { vol: .2, at: .39 }); },
    lose: () => [G5, E5, C5].forEach((f, i) => tone(f / 2, .35, { type: 'triangle', vol: .2, at: i * .25 })),
  };

  function play(name) {
    if (!ctx || settings.muted || !settings.sfx || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* audio node limits on old devices */ }
  }

  // Gentle looping tune on a Sa–Re–Ga–Pa–Dha scale over a tanpura-like drone.
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
  const TUNE = [0, 2, 3, 4, 3, 2, 0, -1, 1, 2, 3, 5, 4, 3, 2, -1, 3, 4, 5, 6, 5, 4, 3, 2, 0, 2, 1, 0, 1, 2, 0, -1];
  const BEAT = .3;

  function startMusic() {
    nextAt = ctx.currentTime + .2;
    musicTimer = setInterval(() => {
      if (document.hidden || settings.muted || !settings.music) { nextAt = ctx.currentTime + .1; return; }
      while (nextAt < ctx.currentTime + .6) {
        const at = nextAt - ctx.currentTime;
        const n = TUNE[step % TUNE.length];
        if (n >= 0) tone(SCALE[n], BEAT * 1.6, { type: 'triangle', vol: .12, at, bus: musicBus });
        if (step % 8 === 0) {
          tone(130.81, BEAT * 8, { vol: .09, at, bus: musicBus });
          tone(196.0, BEAT * 8, { vol: .05, at: at + BEAT * 2, bus: musicBus });
        }
        step++; nextAt += BEAT;
      }
    }, 150);
  }

  return {
    unlock, play,
    get settings() { return settings; },
    set(k, v) { settings[k] = v; applyVolumes(); persist(); },
    toggleMute() { settings.muted = !settings.muted; applyVolumes(); persist(); return settings.muted; },
  };
})();
