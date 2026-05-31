// audio.js — procedural Web Audio API sound system (no audio files needed)

export const Audio = {
  _ctx:        null,
  _musicNodes: null,
  sfxEnabled:  true,
  musicEnabled: false,

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(musicEnabled, sfxEnabled) {
    this.musicEnabled = musicEnabled ?? false;
    this.sfxEnabled   = sfxEnabled   ?? true;
  },

  setMusic(enabled) {
    this.musicEnabled = enabled;
    if (enabled) this._startMusic();
    else         this._stopMusic();
  },

  setSfx(enabled) {
    this.sfxEnabled = enabled;
  },

  play(name) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this._ctx();
      this._sfx[name]?.call(this, ctx);
    } catch (e) {}
  },

  // Lazy AudioContext — created on first user interaction to satisfy browser policy
  _ctx() {
    if (!this.__ctx) {
      this.__ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.__ctx.state === 'suspended') this.__ctx.resume();
    return this.__ctx;
  },

  // ── Sound effects ─────────────────────────────────────────────────────────

  _sfx: {

    // Short ascending coin tones — buy / upgrade
    buy(ctx) {
      const t = ctx.currentTime;
      [[660, 0], [880, 0.07], [1320, 0.13]].forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.10, t + dt);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.18);
        o.start(t + dt); o.stop(t + dt + 0.18);
      });
    },

    // Drum thud + rising whistle — troops deploy
    deploy(ctx) {
      const t = ctx.currentTime;
      // Bass drum
      const od = ctx.createOscillator(), gd = ctx.createGain();
      od.connect(gd); gd.connect(ctx.destination);
      od.type = 'sine';
      od.frequency.setValueAtTime(110, t);
      od.frequency.exponentialRampToValueAtTime(35, t + 0.18);
      gd.gain.setValueAtTime(0.28, t);
      gd.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      od.start(t); od.stop(t + 0.22);
      // Rising whistle
      const ow = ctx.createOscillator(), gw = ctx.createGain();
      ow.connect(gw); gw.connect(ctx.destination);
      ow.type = 'sine';
      ow.frequency.setValueAtTime(330, t + 0.05);
      ow.frequency.exponentialRampToValueAtTime(660, t + 0.25);
      gw.gain.setValueAtTime(0, t + 0.05);
      gw.gain.linearRampToValueAtTime(0.08, t + 0.12);
      gw.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      ow.start(t + 0.05); ow.stop(t + 0.30);
    },

    // Rewarding arpeggio — troops return with loot
    loot(ctx) {
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        const st = t + i * 0.08;
        g.gain.setValueAtTime(0.11, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
        o.start(st); o.stop(st + 0.35);
      });
    },

    // Ascending fanfare — level up
    levelup(ctx) {
      const t = ctx.currentTime;
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        const st = t + i * 0.09;
        g.gain.setValueAtTime(0.13, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.55);
        o.start(st); o.stop(st + 0.55);
      });
    },

    // Low ominous rumble — boss spawns
    boss(ctx) {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 180;
      o.connect(filt); filt.connect(g); g.connect(ctx.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(55, t);
      o.frequency.linearRampToValueAtTime(42, t + 0.5);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.08);
      g.gain.setValueAtTime(0.22, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      o.start(t); o.stop(t + 0.85);
    },

    // Soft prestige chime
    prestige(ctx) {
      const t = ctx.currentTime;
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        const st = t + i * 0.12;
        g.gain.setValueAtTime(0.10, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.8);
        o.start(st); o.stop(st + 0.8);
      });
    },
  },

  // ── Background ambient music ──────────────────────────────────────────────

  _startMusic() {
    this._stopMusic();
    try {
      const ctx    = this._ctx();
      const master = ctx.createGain();
      master.gain.value = 0.055;
      master.connect(ctx.destination);

      this._musicNodes = [];

      // Drone layers: C2, G2, C3, G3 with slight detuning for organic beating
      const drones = [
        { f: 65.41,  det:  0,  vol: 0.55 },
        { f: 98.00,  det:  4,  vol: 0.40 },
        { f: 130.81, det: -3,  vol: 0.35 },
        { f: 196.00, det:  6,  vol: 0.25 },
        { f: 261.63, det: -2,  vol: 0.15 },
      ];

      for (const d of drones) {
        const osc     = ctx.createOscillator();
        const gain    = ctx.createGain();
        const lfo     = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = d.f;
        osc.detune.value    = d.det;

        // Each drone pulses at a slightly different rate for shimmering texture
        lfo.type            = 'sine';
        lfo.frequency.value = 0.08 + Math.random() * 0.06;
        lfoGain.gain.value  = 0.25;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        gain.gain.value = d.vol;
        osc.connect(gain);
        gain.connect(master);

        osc.start();
        lfo.start();
        this._musicNodes.push(osc, lfo);
      }

      // Gentle high shimmer — triangle wave a few octaves up
      const shimmer = ctx.createOscillator();
      const shimGain = ctx.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.value = 523.25; // C5
      shimmer.detune.value    = -5;
      shimGain.gain.value     = 0.06;
      shimmer.connect(shimGain);
      shimGain.connect(master);
      shimmer.start();
      this._musicNodes.push(shimmer);

    } catch (e) {}
  },

  _stopMusic() {
    if (this._musicNodes) {
      for (const n of this._musicNodes) { try { n.stop(); } catch (e) {} }
      this._musicNodes = null;
    }
  },
};
