// ============================================================
// utils.js - Utility functions and seeded RNG
// ============================================================

/**
 * Seeded pseudo-random number generator (Mulberry32)
 */
export class SeededRNG {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed |= 0;
    this.seed = (this.seed + 0x6D2B79F5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  choice(arr) {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/** Get today's date seed */
export function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Linear interpolation */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Clamp value */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Distance between two points */
export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** AABB collision check */
export function aabbCollide(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Ease in-out cubic */
export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Format time mm:ss */
export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Save to localStorage safely */
export function saveData(key, value) {
  try {
    localStorage.setItem('snow_owl_' + key, JSON.stringify(value));
  } catch (e) {}
}

/** Load from localStorage safely */
export function loadData(key, defaultValue = null) {
  try {
    const v = localStorage.getItem('snow_owl_' + key);
    return v !== null ? JSON.parse(v) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/** HSL to hex */
export function hsl(h, s, l) {
  return `hsl(${h},${s}%,${l}%)`;
}

/** Draw rounded rectangle */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Parse color and return rgba */
export function rgba(r, g, b, a) {
  return `rgba(${r},${g},${b},${a})`;
}
