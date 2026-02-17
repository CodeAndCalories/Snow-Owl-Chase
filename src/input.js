// ============================================================
// input.js - Input handling with key buffering + mobile touch
// ============================================================

export class InputHandler {
  constructor(canvas = null) {
    this.keys = {};
    this.justPressed = {};
    this.justReleased = {};
    this._buffer = {};
    this._bufferDuration = 150; // ms
    this._bufferTimers = {};

    // Touch buffer uses same consumeBuffer flow
    this._touchBuffer = {};
    this._touchTimers = {};

    // Touch gesture tracking
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchStartT = 0;
    this._touchActive = false;

    // Tunables for swipe detection
    this._minSwipeDist = 35; // px
    this._maxSwipeTime = 450; // ms

    window.addEventListener('keydown', (e) => this._onKeyDown(e), { passive: false });
    window.addEventListener('keyup', (e) => this._onKeyUp(e));

    // Touch listeners: attach to canvas if provided, else to window
    const target = canvas || window;
    target.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    target.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    target.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

    // Pointer fallback for some mobile browsers
    target.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
  }

  _onKeyDown(e) {
    if (!this.keys[e.code]) {
      this.justPressed[e.code] = true;
      this._bufferPress(e.code);
    }
    this.keys[e.code] = true;

    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS','ShiftLeft','ShiftRight','KeyF','Digit1'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    this.justReleased[e.code] = true;
  }

  _bufferPress(code) {
    this._buffer[code] = true;
    if (this._bufferTimers[code]) clearTimeout(this._bufferTimers[code]);
    this._bufferTimers[code] = setTimeout(() => {
      this._buffer[code] = false;
    }, this._bufferDuration);
  }

  _bufferTouch(code) {
    this._touchBuffer[code] = true;
    if (this._touchTimers[code]) clearTimeout(this._touchTimers[code]);
    this._touchTimers[code] = setTimeout(() => {
      this._touchBuffer[code] = false;
    }, this._bufferDuration);
  }

  _onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];

    this._touchActive = true;
    this._touchStartX = t.clientX;
    this._touchStartY = t.clientY;
    this._touchStartT = performance.now();

    // Stop the page from scrolling while playing
    e.preventDefault();
  }

  _onTouchMove(e) {
    if (this._touchActive) e.preventDefault();
  }

  _onTouchEnd(e) {
    if (!this._touchActive) return;
    this._touchActive = false;

    const endT = performance.now();
    const dt = endT - this._touchStartT;

    // If we cannot read changedTouches, treat as a tap
    const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!ct) {
      this._bufferTouch('TouchTap');
      e.preventDefault();
      return;
    }

    const dx = ct.clientX - this._touchStartX;
    const dy = ct.clientY - this._touchStartY;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    const isSwipe = dt <= this._maxSwipeTime && (adx >= this._minSwipeDist || ady >= this._minSwipeDist);

    if (isSwipe) {
      if (adx > ady) {
        if (dx > 0) this._bufferTouch('TouchRight');
        else this._bufferTouch('TouchLeft');
      } else {
        if (dy < 0) this._bufferTouch('TouchUp');
        else this._bufferTouch('TouchDown');
      }
    } else {
      // Tap
      this._bufferTouch('TouchTap');
    }

    e.preventDefault();
  }

  _onPointerDown(e) {
    // Optional fallback: treat pointer as tap on mobile
    // Avoid interfering with mouse clicks on desktop by only applying when touch is primary
    if (e.pointerType === 'touch') {
      this._bufferTouch('TouchTap');
      e.preventDefault();
    }
  }

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

  consumeBuffer(code) {
    // Keyboard buffer
    if (this._buffer[code]) {
      this._buffer[code] = false;
      if (this._bufferTimers[code]) {
        clearTimeout(this._bufferTimers[code]);
        this._bufferTimers[code] = null;
      }
      return true;
    }

    // Touch buffer
    if (this._touchBuffer[code]) {
      this._touchBuffer[code] = false;
      if (this._touchTimers[code]) {
        clearTimeout(this._touchTimers[code]);
        this._touchTimers[code] = null;
      }
      return true;
    }

    return false;
  }

  anyDown(...codes) {
    return codes.some(c => this.isDown(c));
  }

  anyPressed(...codes) {
    return codes.some(c => this.wasPressed(c));
  }

  anyBuffered(...codes) {
    return codes.some(c => this._buffer[c] || this._touchBuffer[c]);
  }

  consumeAnyBuffer(...codes) {
    for (const c of codes) {
      if (this.consumeBuffer(c)) return c;
    }
    return null;
  }
}
