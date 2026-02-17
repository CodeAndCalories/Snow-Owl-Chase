// ============================================================
// Pickup.js - Collectible pickups
// ============================================================

import { aabbCollide } from '../utils.js';

export const PICKUP_TYPES = {
  FEATHER_AXE: 'feather_axe',
  WIND_GUST: 'wind_gust',
  HOT_COCOA: 'hot_cocoa',
  LANTERN_CHARM: 'lantern_charm',
  LUCKY_BELL: 'lucky_bell',
};

export const PICKUP_INFO = {
  [PICKUP_TYPES.FEATHER_AXE]: { label: 'Feather Axe', color: '#f1c40f', bg: '#e67e22', desc: 'Chop one tree obstacle' },
  [PICKUP_TYPES.WIND_GUST]: { label: 'Wind Gust', color: '#74b9ff', bg: '#0984e3', desc: 'Speed boost' },
  [PICKUP_TYPES.HOT_COCOA]: { label: 'Hot Cocoa', color: '#e17055', bg: '#d63031', desc: 'Reduce stun once' },
  [PICKUP_TYPES.LANTERN_CHARM]: { label: 'Lantern', color: '#ffeaa7', bg: '#fdcb6e', desc: 'Shorter shadow warning' },
  [PICKUP_TYPES.LUCKY_BELL]: { label: 'Lucky Bell', color: '#a29bfe', bg: '#6c5ce7', desc: 'Fewer hard obstacles' },
};

export class Pickup {
  constructor(type, lane, x, y, speed) {
    this.type = type;
    this.lane = lane;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.w = 28;
    this.h = 28;
    this.active = true;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.collected = false;
    this.collectTimer = 0;
    this.collectDuration = 400;
  }

  update(dt) {
    // y position managed externally by game scroll system
    // Only handle collection state here
    if (this.collected) {
      this.collectTimer += dt * 1000;
      if (this.collectTimer >= this.collectDuration) this.active = false;
    }
    this.bobPhase += dt * 2;
  }

  checkCollect(playerHitbox) {
    if (this.collected) return false;
    const bobY = this.y + Math.sin(this.bobPhase) * 4;
    const phb = {
      x: this.x - this.w / 2 - 10,
      y: bobY - this.w / 2 - 10,
      w: this.w + 20,
      h: this.w + 20,
    };
    return aabbCollide(playerHitbox, phb);
  }

  collect() {
    this.collected = true;
    this.collectTimer = 0;
  }

  isOffScreen() {
    return this.y < -50;
  }

  draw(ctx) {
    if (!this.active) return;
    const info = PICKUP_INFO[this.type];
    const cx = this.x;
    const cy = this.y + Math.sin(this.bobPhase) * 4;

    ctx.save();

    if (this.collected) {
      ctx.globalAlpha = 1 - this.collectTimer / this.collectDuration;
      ctx.translate(cx, cy - this.collectTimer * 0.1);
      ctx.scale(1 + this.collectTimer * 0.002, 1 + this.collectTimer * 0.002);
    } else {
      ctx.translate(cx, cy);
    }

    // Glow
    ctx.save();
    ctx.globalAlpha = (this.collected ? ctx.globalAlpha : 1) * 0.3;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    grad.addColorStop(0, info.bg);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Background circle
    ctx.fillStyle = info.bg;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.fillStyle = info.color;
    ctx.font = 'bold 14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._icon(), 0, 0);

    ctx.restore();
  }

  _icon() {
    switch (this.type) {
      case PICKUP_TYPES.FEATHER_AXE: return '🪓';
      case PICKUP_TYPES.WIND_GUST: return '💨';
      case PICKUP_TYPES.HOT_COCOA: return '☕';
      case PICKUP_TYPES.LANTERN_CHARM: return '🏮';
      case PICKUP_TYPES.LUCKY_BELL: return '🔔';
    }
  }
}
