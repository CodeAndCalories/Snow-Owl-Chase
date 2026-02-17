// ============================================================
// Obstacle.js - 7 distinct obstacle types
// ============================================================

import { aabbCollide } from '../utils.js';

export const OBSTACLE_TYPES = {
  LOG: 'log',
  SNOWMAN: 'snowman',
  TREE: 'tree',
  SNOWBALL: 'snowball',
  ICE_PATCH: 'ice_patch',
  THIN_ICE: 'thin_ice',
  SNOWDRIFT: 'snowdrift',
  BRANCH: 'branch',
};

export class Obstacle {
  constructor(type, lane, x, y, speed) {
    this.type = type;
    this.lane = lane;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.active = true;

    // Projectile snowballs from snowmen
    this.projectiles = [];
    this.projectileTimer = 0;

    // Ice/thin ice state
    this.cracked = false;
    this.crackTimer = 0;

    // Configure per type
    this._configure();
  }

  _configure() {
    switch (this.type) {
      case OBSTACLE_TYPES.LOG:
        this.w = 56;
        this.h = 20;
        this.canJump = true;
        this.stunDuration = 1000;
        this.color = '#8B6914';
        break;
      case OBSTACLE_TYPES.SNOWMAN:
        this.w = 30;
        this.h = 52;
        this.canJump = false;
        this.stunDuration = 1200;
        this.color = '#d5e8f0';
        this.isEvil = Math.random() < 0.6; // 40% are benign decoys
        this.projectileCooldown = 2500 + Math.random() * 1500;
        break;
      case OBSTACLE_TYPES.TREE:
        this.w = 34;
        this.h = 80;
        this.canJump = false;
        this.stunDuration = 800;
        this.color = '#2d5a1b';
        this.chopable = true;
        break;
      case OBSTACLE_TYPES.SNOWBALL:
        this.w = 44;
        this.h = 44;
        this.canJump = true;
        this.stunDuration = 1400;
        this.color = '#c8e6f5';
        this.speed *= 1.6; // Faster
        break;
      case OBSTACLE_TYPES.ICE_PATCH:
        this.w = 80;
        this.h = 24;
        this.canJump = false;
        this.stunDuration = 0;
        this.color = '#a8d8ea';
        this.isHazard = false; // Doesn't stun, just slows steering
        break;
      case OBSTACLE_TYPES.THIN_ICE:
        this.w = 60;
        this.h = 20;
        this.canJump = false;
        this.stunDuration = 500;
        this.color = '#cce8f4';
        this.triggered = false;
        this.crackAnimTimer = 0;
        break;
      case OBSTACLE_TYPES.SNOWDRIFT:
        this.w = 90;
        this.h = 32;
        this.canJump = true; // Can jump over
        this.stunDuration = 0;
        this.color = '#e8f4fb';
        this.isHazard = false;
        break;
      case OBSTACLE_TYPES.BRANCH:
        this.w = 60;
        this.h = 14;
        this.canJump = true; // Jump timing hazard
        this.stunDuration = 700;
        this.color = '#5a3a1a';
        break;
    }
  }

  update(dt, playerY) {
    // Position is managed by game scroll system (y += scrollAmt each frame)
    // This method handles internal state only
    this.updateProjectiles(dt, playerY);
    if (this.type === OBSTACLE_TYPES.THIN_ICE && this.triggered) {
      this.crackAnimTimer += dt * 1000;
    }
  }

  updateProjectiles(dt, playerY) {
    // Snowman projectile shooting - fire downward toward player
    if (this.type === OBSTACLE_TYPES.SNOWMAN && this.isEvil) {
      this.projectileTimer += dt * 1000;
      if (this.projectileTimer >= this.projectileCooldown && this.y < playerY - 20 && this.y > -50) {
        this.projectileTimer = 0;
        this.projectiles.push({
          x: this.x,
          y: this.y,
          vy: this.speed * 2.5, // Move DOWN toward player
          vx: (Math.random() - 0.5) * 80,
          w: 10,
          h: 10,
          active: true
        });
      }
    }
    // Update projectiles (they also move down)
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > 800) p.active = false;
    }
    this.projectiles = this.projectiles.filter(p => p.active);
  }

  /** Returns hit result: null | { stun, chopable, slowSteering, slowSpeed } */
  checkCollision(playerHitbox, playerJumping) {
    const ohb = this.getHitbox();

    if (!aabbCollide(playerHitbox, ohb)) return null;
    if (playerJumping && this.canJump) return null;

    switch (this.type) {
      case OBSTACLE_TYPES.ICE_PATCH:
        return { stun: false, slowSteering: true };
      case OBSTACLE_TYPES.SNOWDRIFT:
        return { stun: false, slowSpeed: true };
      case OBSTACLE_TYPES.THIN_ICE:
        if (!this.triggered) {
          this.triggered = true;
        }
        return { stun: true, stunDur: this.stunDuration, slowSpeed: true };
      case OBSTACLE_TYPES.SNOWMAN:
        if (!this.isEvil) return null;
        return { stun: true, stunDur: this.stunDuration };
      case OBSTACLE_TYPES.TREE:
        return { stun: true, stunDur: this.stunDuration, chopable: true };
      default:
        return { stun: true, stunDur: this.stunDuration };
    }
  }

  checkProjectileCollisions(playerHitbox) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const phb = { x: p.x - 5, y: p.y - 5, w: 10, h: 10 };
      if (aabbCollide(playerHitbox, phb)) {
        p.active = false;
        return { stun: true, stunDur: 600 };
      }
    }
    return null;
  }

  getHitbox() {
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h,
      w: this.w,
      h: this.h
    };
  }

  isOffScreen() {
    return this.y > 900 || this.y < -200;
  }

  draw(ctx) {
    const cx = this.x;
    const cy = this.y;

    switch (this.type) {
      case OBSTACLE_TYPES.LOG:
        this._drawLog(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.SNOWMAN:
        this._drawSnowman(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.TREE:
        this._drawTree(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.SNOWBALL:
        this._drawSnowball(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.ICE_PATCH:
        this._drawIcePatch(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.THIN_ICE:
        this._drawThinIce(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.SNOWDRIFT:
        this._drawSnowdrift(ctx, cx, cy);
        break;
      case OBSTACLE_TYPES.BRANCH:
        this._drawBranch(ctx, cx, cy);
        break;
    }

    // Draw projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = '#d4e8f5';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aaccdd';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawLog(ctx, cx, cy) {
    // Log body
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.roundRect(cx - this.w / 2, cy - this.h, this.w, this.h, 8);
    ctx.fill();
    // Wood grain
    ctx.strokeStyle = '#6b4a10';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 + 5, cy - this.h + (this.h / 4) * i);
      ctx.lineTo(cx + this.w / 2 - 5, cy - this.h + (this.h / 4) * i);
      ctx.stroke();
    }
    // End rings
    ctx.fillStyle = '#a07820';
    ctx.beginPath();
    ctx.ellipse(cx - this.w / 2 + 8, cy - this.h / 2, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Snow on top
    ctx.fillStyle = '#e8f4fb';
    ctx.beginPath();
    ctx.ellipse(cx, cy - this.h + 4, this.w / 2 - 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSnowman(ctx, cx, cy) {
    const evil = this.isEvil;
    // Bottom ball
    ctx.fillStyle = '#d5e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy - 16, 16, 0, Math.PI * 2);
    ctx.fill();
    // Middle ball
    ctx.beginPath();
    ctx.arc(cx, cy - 36, 12, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - 52, 10, 0, Math.PI * 2);
    ctx.fill();
    // Eyes - evil has red eyes, benign has black
    ctx.fillStyle = evil ? '#cc3333' : '#333';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 55, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 55, 2, 0, Math.PI * 2);
    ctx.fill();
    // Evil glow
    if (evil) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.003) * 0.1;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(cx, cy - 30, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Benign - subtle warm glow
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#44aaff';
      ctx.beginPath();
      ctx.arc(cx, cy - 30, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Hat
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(cx - 9, cy - 64, 18, 4);
    ctx.fillRect(cx - 7, cy - 74, 14, 12);
    // Carrot nose
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 53);
    ctx.lineTo(cx + 8, cy - 51);
    ctx.lineTo(cx, cy - 49);
    ctx.fill();
    // Buttons
    ctx.fillStyle = '#555';
    [cy - 38, cy - 30, cy - 22].forEach(by => {
      ctx.beginPath();
      ctx.arc(cx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawTree(ctx, cx, cy) {
    const h = this.h;
    // Trunk
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(cx - 6, cy - 28, 12, 28);
    // Three tiers of pine
    const tiers = [
      { w: 34, h: 30, y: cy - 60 },
      { w: 28, h: 26, y: cy - 80 },
      { w: 20, h: 22, y: cy - 96 },
    ];
    tiers.forEach(t => {
      ctx.fillStyle = '#2d5a1b';
      ctx.beginPath();
      ctx.moveTo(cx, t.y - t.h);
      ctx.lineTo(cx - t.w / 2, t.y);
      ctx.lineTo(cx + t.w / 2, t.y);
      ctx.closePath();
      ctx.fill();
      // Snow on branches
      ctx.fillStyle = 'rgba(232,244,251,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - t.w / 4, t.y - 4);
      ctx.lineTo(cx - t.w / 2 + 2, t.y - 2);
      ctx.lineTo(cx - t.w / 6, t.y - 8);
      ctx.fill();
    });
  }

  _drawSnowball(ctx, cx, cy) {
    const r = this.w / 2;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main ball
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, '#f0f8ff');
    grad.addColorStop(0.6, '#c8e6f5');
    grad.addColorStop(1, '#a0c8e0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - r, r, 0, Math.PI * 2);
    ctx.fill();
    // Speed lines
    ctx.strokeStyle = 'rgba(200,230,245,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const len = 20 + i * 10;
      ctx.beginPath();
      ctx.moveTo(cx + r, cy - r - 4 + i * 6);
      ctx.lineTo(cx + r + len, cy - r - 4 + i * 6);
      ctx.stroke();
    }
  }

  _drawIcePatch(ctx, cx, cy) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    const grad = ctx.createLinearGradient(cx - this.w / 2, cy - this.h, cx + this.w / 2, cy);
    grad.addColorStop(0, '#a8d8ea');
    grad.addColorStop(0.5, '#c8ecf8');
    grad.addColorStop(1, '#a8d8ea');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glint
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(cx - this.w * 0.15, cy - this.h * 0.8, this.w * 0.1, this.h * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawThinIce(ctx, cx, cy) {
    ctx.save();
    ctx.globalAlpha = this.triggered ? 0.5 : 0.7;
    ctx.fillStyle = this.triggered ? '#88bbdd' : '#cce8f4';
    ctx.beginPath();
    ctx.roundRect(cx - this.w / 2, cy - this.h, this.w, this.h, 4);
    ctx.fill();

    if (this.triggered) {
      // Crack lines
      ctx.strokeStyle = 'rgba(100,150,200,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - this.h);
      ctx.lineTo(cx - 10, cy - this.h / 2);
      ctx.lineTo(cx + 5, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - this.h);
      ctx.lineTo(cx + 12, cy - this.h * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSnowdrift(ctx, cx, cy) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    const grad = ctx.createRadialGradient(cx, cy - 8, 0, cx, cy - 8, this.w / 2);
    grad.addColorStop(0, '#f5fbff');
    grad.addColorStop(1, '#d0e8f4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawBranch(ctx, cx, cy) {
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.roundRect(cx - this.w / 2, cy - this.h, this.w, this.h, 3);
    ctx.fill();
    // Pine needles
    ctx.fillStyle = '#2d5a1b';
    for (let i = 0; i < 6; i++) {
      const nx = cx - this.w / 2 + 8 + i * 8;
      ctx.beginPath();
      ctx.moveTo(nx, cy - this.h);
      ctx.lineTo(nx - 4, cy - this.h - 10);
      ctx.lineTo(nx + 4, cy - this.h - 10);
      ctx.fill();
    }
    // Snow
    ctx.fillStyle = 'rgba(232,244,251,0.7)';
    ctx.beginPath();
    ctx.roundRect(cx - this.w / 2 + 4, cy - this.h - 5, this.w - 8, 5, 2);
    ctx.fill();
  }
}
