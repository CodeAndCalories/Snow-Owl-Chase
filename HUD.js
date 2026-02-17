// ============================================================
// HUD.js - Heads-up display rendering
// ============================================================

import { roundRect, lerp } from '../utils.js';
import { PICKUP_INFO } from '../entities/Pickup.js';

export class HUD {
  constructor(canvasW, canvasH) {
    this.cw = canvasW;
    this.ch = canvasH;
    this.particles = [];
    this.scorePopups = [];
  }

  addScorePopup(x, y, text, color = '#fff') {
    this.scorePopups.push({ x, y, text, color, alpha: 1, vy: -1 });
  }

  update(dt) {
    for (const p of this.scorePopups) {
      p.y += p.vy;
      p.alpha -= dt * 1.5;
    }
    this.scorePopups = this.scorePopups.filter(p => p.alpha > 0);
  }

  draw(ctx, gameState) {
    const {
      distance, levelLength, speed, score, streak,
      owl, player, level, levelComplete,
      pickupActive, activePickupType,
      swoopsDodged, dashCooldown, dashCooldownMax,
      auroraActive, blizzardActive
    } = gameState;

    // Progress bar (top)
    this._drawProgressBar(ctx, distance, levelLength);

    // Score and streak
    this._drawScore(ctx, score, streak);

    // Threat meter
    owl.drawThreatMeter(ctx, this.cw - 170, 48, 150, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px "Courier New"';
    ctx.textAlign = 'right';
    ctx.fillText('OWL THREAT', this.cw - 175, 60);

    // Pickup indicators
    this._drawPickupIndicator(ctx, player);

    // Dash cooldown
    this._drawDashIndicator(ctx, player);

    // Level indicator
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${level}`, 20, 70);

    // Speed indicator
    const speedPct = Math.floor((speed / 400) * 100);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px "Courier New"';
    ctx.fillText(`${speedPct}km/h`, 20, 85);

    // Special events
    if (auroraActive) {
      ctx.fillStyle = 'rgba(100,255,200,0.8)';
      ctx.font = 'bold 14px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('✨ AURORA BONUS ✨', this.cw / 2, 75);
    }
    if (blizzardActive) {
      ctx.fillStyle = 'rgba(150,200,255,0.8)';
      ctx.font = 'bold 13px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('❄️ BLIZZARD ❄️', this.cw / 2, 75);
    }

    // Swoop dodge counter
    if (swoopsDodged > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.7)';
      ctx.font = '11px "Courier New"';
      ctx.textAlign = 'right';
      ctx.fillText(`${swoopsDodged} swoops dodged`, this.cw - 15, 80);
    }

    // Score popups
    for (const p of this.scorePopups) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  _drawProgressBar(ctx, distance, levelLength) {
    const bw = this.cw - 40;
    const bh = 12;
    const bx = 20;
    const by = 16;
    const progress = Math.min(distance / levelLength, 1);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();

    // Fill gradient
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#74b9ff');
    grad.addColorStop(0.5, '#a29bfe');
    grad.addColorStop(1, '#fd79a8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx + 1, by + 1, Math.max(8, (bw - 2) * progress), bh - 2, 5);
    ctx.fill();

    // Finish line indicator
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + bw - 2, by - 3);
    ctx.lineTo(bx + bw - 2, by + bh + 3);
    ctx.stroke();

    // Distance text
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '10px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(distance)}m / ${levelLength}m`, this.cw / 2, by + bh + 14);
  }

  _drawScore(ctx, score, streak) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 22px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText(score.toLocaleString(), 20, 52);

    if (streak > 1) {
      ctx.fillStyle = streak > 5 ? '#ffd700' : '#f0c040';
      ctx.font = `bold ${11 + Math.min(streak, 10)}px "Courier New"`;
      ctx.fillText(`×${streak.toFixed(1)} STREAK`, 20, 52 + 16);
    }
  }

  _drawPickupIndicator(ctx, player) {
    const px = this.cw - 170;
    const py = 80;

    // Axe
    const axeAlpha = player.hasAxe ? 1 : 0.3;
    ctx.save();
    ctx.globalAlpha = axeAlpha;
    ctx.fillStyle = player.hasAxe ? '#f1c40f' : '#555';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪓', px, py + 5);
    ctx.restore();

    if (player.hasAxe) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('[1/F]', px, py + 22);
    }
  }

  _drawDashIndicator(ctx, player) {
    const px = this.cw - 140;
    const py = 78;
    const size = 50;

    // Dash cooldown arc
    const coolPct = Math.max(0, player.dashCooldown / player.dashCooldownMax);
    const ready = coolPct <= 0;

    ctx.save();
    ctx.strokeStyle = ready ? '#74b9ff' : 'rgba(100,150,200,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 10, -Math.PI / 2, -Math.PI / 2 + (1 - coolPct) * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = ready ? 'rgba(116,185,255,0.8)' : 'rgba(100,150,200,0.3)';
    ctx.font = '9px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('DASH', px, py + 20);
    ctx.fillText('[Shift]', px, py + 30);
    ctx.restore();
  }
}
