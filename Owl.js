// ============================================================
// Owl.js - The snow owl with threat system and swoop attacks
// ============================================================

import { lerp, clamp } from '../utils.js';

export class Owl {
  constructor(canvasW, canvasH) {
    this.cw = canvasW;
    this.ch = canvasH;

    // Threat: 0 (far away) to 1 (about to attack)
    this.threat = 0.1;

    // Visual position (owl in background, mostly unseen)
    this.eyeAlpha = 0;
    this.eyeBlinkTimer = 0;
    this.eyeX = canvasW / 2;
    this.eyeY = 80;

    // Swoop state
    this.swoopActive = false;
    this.swoopPhase = 'none'; // none | shadow | swoop | retreat
    this.swoopTimer = 0;
    this.swoopDuration = 0;
    this.shadowWarningDuration = 2000; // ms
    this.shadows = []; // { x, y, w, h, timer, maxTimer, isFake }

    // Cooldown between swoops
    this.swoopCooldown = 0;
    this.swoopCooldownBase = 8000;

    // Swoop line for animation
    this.swoopLines = [];

    // Sound cue
    this.lastScreechThreat = 0;

    // Appearance
    this.wingPhase = 0;
  }

  update(dt, playerX, playerY, playerLane, lanePositions, difficulty, shadowWarnMult, audio) {
    const dtMs = dt * 1000;

    // Animate eyes
    this.wingPhase += dt * (1 + this.threat * 2);
    this.eyeBlinkTimer -= dtMs;
    if (this.eyeBlinkTimer <= 0) {
      this.eyeAlpha = this.threat > 0.3 ? this.threat : 0;
      this.eyeBlinkTimer = 1500 + Math.random() * 2000;
    }

    // Screech sound as threat ramps
    if (this.threat > 0.6 && this.threat - this.lastScreechThreat > 0.15) {
      this.lastScreechThreat = this.threat;
      if (audio) audio.playOwlScreech((this.threat - 0.6) / 0.4);
    }

    // Swoop cooldown
    if (this.swoopCooldown > 0) {
      this.swoopCooldown -= dtMs;
    }

    // Update shadows
    for (const s of this.shadows) {
      s.timer -= dtMs;
    }

    // Update swoop lines
    for (const sl of this.swoopLines) {
      sl.alpha -= dt * 2;
    }
    this.swoopLines = this.swoopLines.filter(sl => sl.alpha > 0);

    // Trigger swoop when threat high enough
    if (
      !this.swoopActive &&
      this.swoopCooldown <= 0 &&
      this.threat >= 0.45
    ) {
      this._startSwoop(playerX, playerY, playerLane, lanePositions, difficulty, shadowWarnMult);
    }
  }

  _startSwoop(playerX, playerY, playerLane, lanePositions, difficulty, shadowWarnMult) {
    this.swoopActive = true;
    this.swoopPhase = 'shadow';

    const warnDur = (this.shadowWarningDuration * shadowWarnMult) / (1 + difficulty * 0.15);

    // Create 1 or 2 shadows (harder = more)
    const numShadows = difficulty >= 3 ? (Math.random() < 0.4 ? 2 : 1) : 1;

    this.shadows = [];

    for (let i = 0; i < numShadows; i++) {
      const isFake = (difficulty >= 4 && i > 0 && Math.random() < 0.35);
      // Pick a random lane
      const lane = Math.floor(Math.random() * 5);
      const sx = lanePositions[lane];
      const shadowSize = 50 + difficulty * 8;

      this.shadows.push({
        x: sx,
        y: playerY - 30, // At ground level near player
        w: shadowSize,
        h: shadowSize * 0.5,
        timer: warnDur,
        maxTimer: warnDur,
        isFake,
        lane
      });
    }

    this.swoopDuration = warnDur;
    this.swoopTimer = warnDur;

    this.swoopTimeout = setTimeout(() => {
      this._executeSwoops(playerX, playerY);
    }, warnDur);
  }

  _executeSwoops(playerX, playerY) {
    if (!this.swoopActive) return;
    this.swoopPhase = 'swoop';

    for (const s of this.shadows) {
      if (!s.isFake) {
        this.swoopLines.push({
          x: s.x,
          y: 0,          // From top of screen
          x2: s.x,
          y2: playerY + 30,  // To player position
          alpha: 1
        });
      }
    }

    this.shadows = [];
    this.swoopActive = false;
    this.swoopPhase = 'none';
    this.swoopCooldown = this.swoopCooldownBase;
  }

  /** Check if player is inside an active (non-fake) shadow zone */
  isPlayerInShadow(playerHitbox) {
    for (const s of this.shadows) {
      if (s.isFake) continue;
      const sw2 = s.w / 2;
      const sh2 = s.h / 2;
      if (
        playerHitbox.x < s.x + sw2 &&
        playerHitbox.x + playerHitbox.w > s.x - sw2 &&
        playerHitbox.y < s.y + sh2 &&
        playerHitbox.y + playerHitbox.h > s.y - sh2
      ) return true;
    }
    return false;
  }

  /** Returns true and triggers capture if swoop just executed and player was in shadow */
  checkSwoopCapture(playerHitbox) {
    for (const sl of this.swoopLines) {
      if (sl.alpha > 0.7) { // Just executed
        const margin = 30;
        if (Math.abs(playerHitbox.x + playerHitbox.w / 2 - sl.x) < margin) {
          return true;
        }
      }
    }
    return false;
  }

  /** Increase threat */
  increaseThreat(amount) {
    this.threat = clamp(this.threat + amount, 0, 1);
  }

  /** Decrease threat */
  decreaseThreat(amount) {
    this.threat = clamp(this.threat - amount, 0, 1);
  }

  /** Cancel all swoop state (for level end etc.) */
  cancelSwoop() {
    if (this.swoopTimeout) clearTimeout(this.swoopTimeout);
    this.swoopActive = false;
    this.swoopPhase = 'none';
    this.shadows = [];
    this.swoopLines = [];
  }

  draw(ctx, canvasW, canvasH) {
    // Draw owl eyes in background fog
    if (this.eyeAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.eyeAlpha * 0.6;
      const ey = 60 + Math.sin(this.wingPhase * 0.5) * 10;
      // Glow
      const grad = ctx.createRadialGradient(canvasW / 2, ey, 0, canvasW / 2, ey, 80);
      grad.addColorStop(0, 'rgba(255,200,50,0.4)');
      grad.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(canvasW / 2 - 80, ey - 30, 160, 60);
      // Eyes
      ctx.globalAlpha = this.eyeAlpha;
      const eyeSpacing = 22 + this.threat * 10;
      [-eyeSpacing, eyeSpacing].forEach(dx => {
        ctx.fillStyle = 'rgba(255,200,50,0.9)';
        ctx.beginPath();
        ctx.ellipse(canvasW / 2 + dx, ey, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(canvasW / 2 + dx, ey, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Draw swoop shadow warning
    for (const s of this.shadows) {
      const progress = 1 - s.timer / s.maxTimer;
      const pulse = Math.sin(progress * Math.PI * 10) * 0.15;
      ctx.save();

      if (s.isFake) {
        ctx.globalAlpha = (0.15 + pulse) * (s.timer / s.maxTimer);
        ctx.fillStyle = 'rgba(150,100,200,0.4)';
      } else {
        ctx.globalAlpha = (0.3 + pulse + progress * 0.2) * (s.timer / s.maxTimer);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
      }

      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warning ring that shrinks inward
      ctx.globalAlpha = 0.5 * (s.timer / s.maxTimer);
      ctx.strokeStyle = s.isFake ? '#aa88ff' : '#ff4444';
      ctx.lineWidth = 2;
      const ringScale = 1 - progress * 0.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, (s.w / 2) * ringScale, (s.h / 2) * ringScale, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Draw swoop lines (attack animation)
    for (const sl of this.swoopLines) {
      ctx.save();
      ctx.globalAlpha = sl.alpha;
      const grad = ctx.createLinearGradient(sl.x, sl.y, sl.x2, sl.y2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 8 + sl.alpha * 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y);
      ctx.lineTo(sl.x2, sl.y2);
      ctx.stroke();
      // Talon marks
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(200,200,255,${sl.alpha})`;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sl.x2 + i * 8, sl.y2 - 10);
        ctx.lineTo(sl.x2 + i * 8 + i * 5, sl.y2 + 20);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawThreatMeter(ctx, x, y, w, h) {
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // Fill
    const fillW = (w - 4) * this.threat;
    const r = Math.floor(lerp(50, 220, this.threat));
    const g = Math.floor(lerp(150, 30, this.threat));
    const b = Math.floor(lerp(220, 30, this.threat));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, fillW, h - 4, 3);
    ctx.fill();

    // Owl icon
    ctx.fillStyle = '#fff';
    ctx.font = '12px serif';
    ctx.fillText('🦉', x + w - 18, y + h - 2);
  }
}
