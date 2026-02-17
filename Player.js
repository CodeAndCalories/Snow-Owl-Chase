// ============================================================
// Player.js - Player entity with stats and character perks
// ============================================================

import { lerp, clamp } from '../utils.js';

export const CHARACTERS = [
  {
    id: 'sprinter',
    name: 'The Sprinter',
    perk: '+12% base speed, faster dash recharge',
    tradeoff: '+20% stun duration, -8% jump hang time',
    color: '#e74c3c',
    scarfColor: '#c0392b',
    hatType: 'beanie',
    stats: {
      speedMult: 1.12,
      stunMult: 1.20,
      jumpHangMult: 0.92,
      dashCooldownMult: 0.85,
      shadowWarningMult: 1.0,
      pickupFreqMult: 1.0,
      scoreMult: 1.0,
      invulMult: 1.0,
    }
  },
  {
    id: 'jumper',
    name: 'The Jumper',
    perk: '+25% jump height, +15% hang time',
    tradeoff: '+20% dash cooldown, -8% base speed',
    color: '#3498db',
    scarfColor: '#2980b9',
    hatType: 'tophat',
    stats: {
      speedMult: 0.92,
      stunMult: 1.0,
      jumpHangMult: 1.15,
      dashCooldownMult: 1.20,
      shadowWarningMult: 1.0,
      pickupFreqMult: 1.0,
      scoreMult: 1.0,
      invulMult: 1.0,
      jumpHeightMult: 1.25,
    }
  },
  {
    id: 'survivor',
    name: 'The Survivor',
    perk: '-30% stun duration, +40% invulnerability frames',
    tradeoff: '-10% acceleration back to top speed',
    color: '#2ecc71',
    scarfColor: '#27ae60',
    hatType: 'hood',
    stats: {
      speedMult: 1.0,
      stunMult: 0.70,
      jumpHangMult: 1.0,
      dashCooldownMult: 1.0,
      shadowWarningMult: 1.0,
      pickupFreqMult: 1.0,
      scoreMult: 1.0,
      invulMult: 1.4,
      accelMult: 0.9,
    }
  },
  {
    id: 'scout',
    name: 'The Scout',
    perk: '+30% shadow warning time, +20% pickup frequency',
    tradeoff: '-10% score multiplier, -15% dash distance',
    color: '#f39c12',
    scarfColor: '#e67e22',
    hatType: 'cap',
    stats: {
      speedMult: 1.0,
      stunMult: 1.0,
      jumpHangMult: 1.0,
      dashCooldownMult: 1.0,
      shadowWarningMult: 1.30,
      pickupFreqMult: 1.20,
      scoreMult: 0.90,
      invulMult: 1.0,
      dashDistMult: 0.85,
    }
  }
];

export class Player {
  constructor(x, y, character, attributesMode) {
    this.character = character;
    this.attributesMode = attributesMode;
    const stats = (attributesMode && character) ? character.stats : {};

    // Position
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 44;

    // Lane system
    this.lane = 2; // center
    this.targetLane = 2;
    this.laneX = x; // actual pixel x target
    this.lerpSpeed = 8; // how fast we lerp between lanes

    // Speed
    this.baseSpeed = 280 * (stats.speedMult || 1);
    this.speed = this.baseSpeed;
    this.maxSpeed = this.baseSpeed;

    // Jump
    this.jumping = false;
    this.jumpVY = 0;
    this.jumpY = 0; // visual offset
    this.groundY = y;
    this.jumpPower = -520 * (stats.jumpHeightMult || 1);
    this.gravity = 1400;
    this.hangMultiplier = stats.jumpHangMult || 1;
    this.jumpCooldown = 0;

    // Stun
    this.stunned = false;
    this.stunTimer = 0;
    this.stunDuration = 0;
    this.stunMult = stats.stunMult || 1;
    this.invulTimer = 0;
    this.invulDuration = 1200 * (stats.invulMult || 1); // ms
    this.accelMult = stats.accelMult || 1;

    // Dash
    this.dashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashCooldownMax = 3000 * (stats.dashCooldownMult || 1);
    this.dashDuration = 250;
    this.dashDistMult = stats.dashDistMult || 1;

    // Feather Axe
    this.hasAxe = false;

    // Visual
    this.color = (character && character.color) || '#e8f4fd';
    this.scarfColor = (character && character.scarfColor) || '#e74c3c';
    this.hatType = (character && character.hatType) || 'beanie';
    this.footprintTimer = 0;

    // State
    this.dead = false;
    this.distanceTraveled = 0;
    this.stunCount = 0;
    this.swoopsDodged = 0;

    // Footprint trail
    this.footprints = [];
  }

  applyLanePositions(lanePositions) {
    this.lanePositions = lanePositions;
    this.laneX = lanePositions[this.lane];
    this.x = this.laneX;
  }

  moveLeft() {
    if (this.stunned) return;
    this.targetLane = clamp(this.targetLane - 1, 0, 4);
  }

  moveRight() {
    if (this.stunned) return;
    this.targetLane = clamp(this.targetLane + 1, 0, 4);
  }

  jump(audio) {
    if (!this.jumping && !this.stunned && this.jumpCooldown <= 0) {
      this.jumping = true;
      this.jumpVY = this.jumpPower;
      this.jumpCooldown = 100;
      if (audio) audio.playJump();
    }
  }

  dash(audio) {
    if (this.dashCooldown <= 0 && !this.stunned && !this.dashing) {
      this.dashing = true;
      this.dashTimer = this.dashDuration;
      this.dashCooldown = this.dashCooldownMax;
      this.speed = this.baseSpeed * 1.8 * this.dashDistMult;
      if (audio) audio.playDash();
    }
  }

  useAxe() {
    if (this.hasAxe) {
      this.hasAxe = false;
      return true;
    }
    return false;
  }

  stun(durationMs, audio) {
    if (this.invulTimer > 0 || this.stunned) return;
    this.stunned = true;
    this.stunDuration = durationMs * this.stunMult;
    this.stunTimer = this.stunDuration;
    this.speed = this.baseSpeed * 0.4;
    this.stunCount++;
    if (audio) audio.playStun();
  }

  update(dt, lanePositions) {
    this.lanePositions = lanePositions;
    const dtMs = dt * 1000;

    // Stun
    if (this.stunned) {
      this.stunTimer -= dtMs;
      if (this.stunTimer <= 0) {
        this.stunned = false;
        this.invulTimer = this.invulDuration;
      }
    }

    // Invulnerability
    if (this.invulTimer > 0) {
      this.invulTimer -= dtMs;
      // Accelerate back to base speed
      this.speed = lerp(this.speed, this.baseSpeed, 0.003 * this.accelMult * dtMs);
    }

    // Dash
    if (this.dashing) {
      this.dashTimer -= dtMs;
      if (this.dashTimer <= 0) {
        this.dashing = false;
        this.speed = this.baseSpeed;
      }
    }

    // Dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dtMs;
    }

    // Jump cooldown
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= dtMs;
    }

    // Jump physics
    if (this.jumping) {
      // Slower hang at apex for hang time multiplier
      const hangFactor = Math.abs(this.jumpVY) < 200 ? this.hangMultiplier : 1;
      this.jumpVY += this.gravity * dt / hangFactor;
      this.jumpY += this.jumpVY * dt;
      if (this.jumpY >= 0) {
        this.jumpY = 0;
        this.jumping = false;
        this.jumpVY = 0;
      }
    }

    // Smooth lane movement
    const targetX = lanePositions[this.targetLane];
    this.x = lerp(this.x, targetX, this.lerpSpeed * dt);

    // Lane sync
    const distToTarget = Math.abs(this.x - targetX);
    if (distToTarget < 1) {
      this.x = targetX;
      this.lane = this.targetLane;
    }

    // Footprints
    this.footprintTimer -= dtMs;
    if (this.footprintTimer <= 0 && !this.jumping) {
      this.footprintTimer = 180;
      this.footprints.push({ x: this.x, worldY: 0, alpha: 1, lane: this.lane });
      if (this.footprints.length > 20) this.footprints.shift();
    }

    // Update footprint alpha
    for (const fp of this.footprints) {
      fp.alpha -= dt * 0.4;
    }
    this.footprints = this.footprints.filter(fp => fp.alpha > 0);
  }

  getHitbox() {
    // Slightly narrower hitbox
    const margin = 6;
    return {
      x: this.x - this.w / 2 + margin,
      y: this.y + this.jumpY - this.h + 8,
      w: this.w - margin * 2,
      h: this.h - 8
    };
  }

  draw(ctx) {
    const cx = this.x;
    const cy = this.y + this.jumpY;

    // Blink if invulnerable
    if (this.invulTimer > 0 && Math.floor(this.invulTimer / 80) % 2 === 0) return;

    ctx.save();

    // Shadow on ground
    if (this.jumping && this.jumpY < -10) {
      ctx.globalAlpha = 0.2 + (Math.abs(this.jumpY) / 200) * 0.1;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, this.y, this.w * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Stun effect
    if (this.stunned) {
      const shake = Math.sin(Date.now() * 0.04) * 3;
      ctx.translate(shake, 0);
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    // Legs
    ctx.fillStyle = this.color;
    const legY = cy - 8;
    ctx.fillRect(cx - 9, legY, 7, 16);
    ctx.fillRect(cx + 2, legY, 7, 16);

    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(cx - 12, cy - 34, 24, 28, 4);
    ctx.fill();

    // Scarf
    ctx.fillStyle = this.scarfColor;
    ctx.fillRect(cx - 13, cy - 24, 26, 7);

    // Head
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx, cy - 42, 11, 0, Math.PI * 2);
    ctx.fill();

    // Hat
    this._drawHat(ctx, cx, cy - 53);

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(cx - 5, cy - 46, 3, 3);
    ctx.fillRect(cx + 2, cy - 46, 3, 3);

    // Axe indicator
    if (this.hasAxe) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(cx + 15, cy - 35, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(cx + 12, cy - 37, 6, 2);
    }

    ctx.restore();
  }

  _drawHat(ctx, cx, ty) {
    switch (this.hatType) {
      case 'beanie':
        ctx.fillStyle = this.scarfColor;
        ctx.beginPath();
        ctx.roundRect(cx - 10, ty, 20, 12, [6, 6, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tophat':
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(cx - 7, ty - 10, 14, 18);
        ctx.fillRect(cx - 12, ty + 6, 24, 4);
        break;
      case 'hood':
        ctx.fillStyle = this.scarfColor;
        ctx.beginPath();
        ctx.arc(cx, ty + 8, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(cx - 14, ty + 8, 28, 6);
        break;
      case 'cap':
        ctx.fillStyle = this.scarfColor;
        ctx.beginPath();
        ctx.roundRect(cx - 10, ty, 20, 8, [4, 4, 0, 0]);
        ctx.fill();
        ctx.fillRect(cx - 14, ty + 6, 22, 3);
        break;
    }
  }
}
