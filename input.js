// ============================================================
// input.js - Input handling with key buffering
// ============================================================

export class InputHandler {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this.justReleased = {};
    this._buffer = {}; // For buffered inputs (lane swaps etc.)
    this._bufferDuration = 150; // ms
    this._bufferTimers = {};

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
  }

  _onKeyDown(e) {
    if (!this.keys[e.code]) {
      this.justPressed[e.code] = true;
      // Buffer this press
      this._buffer[e.code] = true;
      if (this._bufferTimers[e.code]) clearTimeout(this._bufferTimers[e.code]);
      this._bufferTimers[e.code] = setTimeout(() => {
        this._buffer[e.code] = false;
      }, this._bufferDuration);
    }
    this.keys[e.code] = true;
    // Prevent default for game keys
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
         'KeyA','KeyD','KeyW','KeyS'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    this.justReleased[e.code] = true;
  }

  /** Call at end of each frame to clear per-frame states */
  update() {
    this.justPressed = {};
    this.justReleased = {};
  }

  isDown(code) {
    return !!this.keys[code];
  }

  wasPressed(code) {
    return !!this.justPressed[code];
  }

  /** Consume buffered press (use for lane swaps) */
  consumeBuffer(code) {
    if (this._buffer[code]) {
      this._buffer[code] = false;
      if (this._bufferTimers[code]) {
        clearTimeout(this._bufferTimers[code]);
        this._bufferTimers[code] = null;
      }
      return true;
    }
    return false;
  }

  /** Check any of multiple codes */
  anyDown(...codes) {
    return codes.some(c => this.isDown(c));
  }

  anyPressed(...codes) {
    return codes.some(c => this.wasPressed(c));
  }

  anyBuffered(...codes) {
    return codes.some(c => this._buffer[c]);
  }

  consumeAnyBuffer(...codes) {
    for (const c of codes) {
      if (this.consumeBuffer(c)) return c;
    }
    return null;
  }
}
