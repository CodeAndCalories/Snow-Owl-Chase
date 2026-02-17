// ============================================================
// NPC.js - Runner NPCs that can be snatched by the owl
// ============================================================

import { lerp } from '../utils.js';

const NPC_COLORS = [
  { body: '#e67e22', scarf: '#c0392b' },
  { body: '#9b59b6', scarf: '#8e44ad' },
  { body: '#1abc9c', scarf: '#16a085' },
  { body: '#e91e8c', scarf: '#c2185b' },
];

export class NPC {
  constructor(x, y, speed, lanePositions) {
    this.x = x;
    this.y = y;
    this.speed = speed * (0.8 + Math.random() * 0.4);
    this.lanePositions = lanePositions;
    this.w = 22;
    this.h = 38;
    this.lane = Math.floor(Math.random() * 5);
    this.targetLane = this.lane;
    this.x = lanePositions[this.lane];
    this.active = true;
    this.snatched = false;
    this.snatchTimer = 0;
    this.snatchDuration = 800;
    this.snatchY = 0;
    this.rescued = false;
    const c = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];
    this.color = c.body;
    this.scarfColor = c.scarf;
    this.laneChangeTimer = 1000 + Math.random() * 2000;
    this.animPhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    const dtMs = dt * 1000;

    if (this.snatched) {
      this.snatchTimer += dtMs;
      this.snatchY -= dt * 300; // Fly upward
      if (this.snatchTimer >= this.snatchDuration) {
        this.active = false;
      }
      return;
    }

    // Random lane changes
    this.laneChangeTimer -= dtMs;
    if (this.laneChangeTimer <= 0) {
      this.laneChangeTimer = 1500 + Math.random() * 2500;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.targetLane = Math.max(0, Math.min(4, this.targetLane + dir));
    }

    // Smooth lane movement
    const targetX = this.lanePositions[this.targetLane];
    this.x = lerp(this.x, targetX, 6 * dt);

    this.animPhase += dt * 8;
    // Note: y position is managed externally by game scroll system
  }

  snatch(audio) {
    if (this.snatched) return;
    this.snatched = true;
    this.snatchTimer = 0;
    if (audio) {
      audio.playNPCScream();
    }
  }

  getHitbox() {
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h,
      w: this.w,
      h: this.h
    };
  }

  draw(ctx) {
    if (!this.active) return;

    const cx = this.x;
    const cy = this.y + this.snatchY;

    ctx.save();
    if (this.snatched) {
      ctx.globalAlpha = 1 - this.snatchTimer / this.snatchDuration;
    }

    // Running animation
    const bob = Math.sin(this.animPhase) * 2;
    const legSwing = Math.sin(this.animPhase) * 8;

    // Legs
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - 7, cy - 8 + bob, 5, 12);
    ctx.fillRect(cx + 2, cy - 8 - bob, 5, 12);

    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(cx - 9, cy - 26 + bob, 18, 20, 3);
    ctx.fill();

    // Scarf
    ctx.fillStyle = this.scarfColor;
    ctx.fillRect(cx - 10, cy - 18 + bob, 20, 5);

    // Head
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx, cy - 32 + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(cx - 3, cy - 34 + bob, 2, 2);
    ctx.fillRect(cx + 1, cy - 34 + bob, 2, 2);

    // Snatch effect: fear expression
    if (this.snatched) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      // Screaming mouth
      ctx.beginPath();
      ctx.arc(cx, cy - 30 + bob, 3, 0, Math.PI);
      ctx.stroke();
      // Fear lines
      ctx.strokeStyle = 'rgba(255,100,100,0.7)';
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * 10, cy - 32 + Math.sin(angle) * 10 + bob);
        ctx.lineTo(cx + Math.cos(angle) * 16, cy - 32 + Math.sin(angle) * 16 + bob);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
