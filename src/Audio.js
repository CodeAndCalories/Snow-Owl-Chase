// ============================================================
// Audio.js - WebAudio oscillator-based sound system
// ============================================================

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.enabled = true;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.3;
    this._musicNode = null;
    this._musicOscillators = [];
    this._ambientInterval = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _playTone(freq, type, duration, volume = 0.3, destination = null) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(destination || this.sfxGain);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  _playNote(freq, type, startTime, duration, volume = 0.2) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {}
  }

  // --- SFX ---

  playJump() {
    this._playTone(400, 'sine', 0.15, 0.2);
    this._playTone(600, 'sine', 0.1, 0.1);
  }

  playLand() {
    this._playTone(150, 'triangle', 0.1, 0.15);
  }

  playStun() {
    if (!this.ctx) return;
    this._playTone(200, 'sawtooth', 0.4, 0.3);
    this._playTone(150, 'sawtooth', 0.3, 0.2);
  }

  playAxeChop() {
    this._playTone(300, 'square', 0.1, 0.3);
    this._playTone(150, 'sawtooth', 0.2, 0.3);
  }

  playPickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      this._playNote(f, 'triangle', t + i * 0.07, 0.15, 0.25);
    });
  }

  playShadowWarning() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._playNote(110, 'sawtooth', t, 0.3, 0.15);
    this._playNote(88, 'sawtooth', t + 0.3, 0.3, 0.2);
  }

  playOwlScreech(intensity = 0) {
    if (!this.ctx) return;
    const freq = 180 + intensity * 120;
    this._playTone(freq, 'sawtooth', 0.6, 0.25 + intensity * 0.15);
  }

  playOwlCapture() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [200, 160, 120, 90].forEach((f, i) => {
      this._playNote(f, 'sawtooth', t + i * 0.1, 0.15, 0.4);
    });
  }

  playNPCScream() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [800, 700, 600, 900, 400].forEach((f, i) => {
      this._playNote(f, 'sine', t + i * 0.05, 0.08, 0.15);
    });
  }

  playLevelComplete() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      this._playNote(f, 'triangle', t + i * 0.15, 0.2, 0.3);
    });
  }

  playDash() {
    this._playTone(500, 'sine', 0.08, 0.2);
    this._playTone(700, 'sine', 0.06, 0.15);
  }

  playIceCrack() {
    this._playTone(800, 'square', 0.05, 0.08);
    this._playTone(600, 'square', 0.08, 0.06);
  }

  // --- Ambient Music ---

  startAmbientMusic() {
    if (!this.ctx) return;
    this._stopAmbientMusic();
    this._playAmbientLoop();
  }

  _playAmbientLoop() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Slow, eerie ambient
    const notes = [130, 110, 98, 87, 110, 130, 87, 98];
    const interval = 2.0;
    notes.forEach((f, i) => {
      this._playNote(f, 'sine', t + i * interval, interval * 0.8, 0.08);
    });
    // Schedule next loop
    this._ambientInterval = setTimeout(() => this._playAmbientLoop(), notes.length * interval * 1000 - 200);
  }

  _stopAmbientMusic() {
    if (this._ambientInterval) {
      clearTimeout(this._ambientInterval);
      this._ambientInterval = null;
    }
  }

  stopAmbientMusic() {
    this._stopAmbientMusic();
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setSFXVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  toggleEnabled() {
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? 1 : 0;
    }
    return this.enabled;
  }
}
