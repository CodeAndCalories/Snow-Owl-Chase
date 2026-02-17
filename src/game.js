// ============================================================
// game.js - Core game state, rendering, and game loop
// ============================================================

import { Player, CHARACTERS } from './entities/Player.js';
import { Owl } from './entities/Owl.js';
import { Spawner } from './systems/Spawner.js';
import { CollisionSystem } from './systems/Collision.js';
import { HUD } from './ui/HUD.js';
import { Pickup, PICKUP_TYPES, PICKUP_INFO } from './entities/Pickup.js';
import { SeededRNG, getDailySeed, lerp, clamp, saveData, loadData, formatTime, rgba } from './utils.js';

const LANE_COUNT = 5;
const LEVEL_LENGTHS = [600, 900, 1200, 1600, 2000, 2500, 3000]; // meters per level
const BASE_SPEED = 280;

// Upgrade options for between-level screen
const UPGRADES = [
  { id: 'long_jump', name: 'Spring Legs', desc: '+20% jump hang time', icon: '🦘' },
  { id: 'fast_recovery', name: 'Quick Feet', desc: '-25% stun duration', icon: '⚡' },
  { id: 'dash_cooldown', name: 'Tailwind', desc: '-20% dash cooldown', icon: '💨' },
  { id: 'small_hitbox', name: 'Nimble Frame', desc: 'Smaller hitbox', icon: '🎯' },
  { id: 'more_pickups', name: 'Sharp Eyes', desc: '+30% more pickups', icon: '👁️' },
];

export class Game {
  constructor(canvas, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;

    this.cw = canvas.width;
    this.ch = canvas.height;

    // Lane positions
    this.lanePositions = this._computeLanes();

    // Game state
    this.state = 'title'; // title | charselect | playing | paused | levelcomplete | gameover | upgrade | howtoplay | settings | endless

    // Progression
    this.level = 1;
    this.selectedCharIdx = loadData('selectedChar', 0);
    this.attributesMode = loadData('attributesMode', true);
    this.upgrades = loadData('upgrades', []);
    this.achievements = loadData('achievements', {});
    this.bestScore = loadData('bestScore', 0);
    this.totalChopped = loadData('totalChopped', 0);
    this.totalSwoopsDodged = loadData('totalSwoopsDodged', 0);

    // Daily seed
    this.dailySeed = getDailySeed();
    this.useDailySeed = false;

    // Entities (initialized in startLevel)
    this.player = null;
    this.owl = null;
    this.obstacles = [];
    this.pickups = [];
    this.npcs = [];
    this.spawner = null;
    this.collision = new CollisionSystem();
    this.hud = new HUD(this.cw, this.ch);

    // Background
    this.snowflakes = this._initSnow();
    this.bgTrees = this._initBgTrees();
    this.bgScrollY = 0;
    this.footprintsWorld = [];

    // Game metrics
    this.distance = 0;
    this.score = 0;
    this.streak = 1;
    this.cleanStreak = 0;
    this.time = 0;
    this.swoopsDodged = 0;
    this.npcsSaved = 0;
    this.runScore = 0;
    this.runHits = 0;

    // Special events
    this.auroraActive = false;
    this.auroraTimer = 0;
    this.blizzardActive = false;
    this.blizzardTimer = 0;
    this.eventCooldown = 15000;
    this.eventTimer = 20000;

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
    this.shakeDuration = 0;

    // Stun overlay
    this.stunOverlayAlpha = 0;

    // UI state
    this.selectedUpgradeIdx = 1;
    this.upgradeOptions = [];
    this.pauseMenuIdx = 0;
    this.charSelectIdx = this.selectedCharIdx;

    // Rng for current level
    this.rng = new SeededRNG(this.dailySeed + this.level * 7);

    // NPC snatch timer
    this.npcSnatchTimer = 5000 + Math.random() * 5000;

    // Shadow dodge tracking
    this.wasInShadow = false;
    this.shadowDodgeTimer = 0;

    // Endless mode
    this.isEndless = false;
  }

  _computeLanes() {
    const margin = 80;
    const usableW = this.cw - margin * 2;
    const laneW = usableW / (LANE_COUNT - 1);
    const positions = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      positions.push(margin + i * laneW);
    }
    return positions;
  }

  _initSnow() {
    const flakes = [];
    for (let i = 0; i < 120; i++) {
      flakes.push({
        x: Math.random() * this.cw,
        y: Math.random() * this.ch,
        r: 0.5 + Math.random() * 2.5,
        vy: 30 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 20,
        alpha: 0.4 + Math.random() * 0.6,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    return flakes;
  }

  _initBgTrees() {
    const trees = [];
    // Far background
    for (let i = 0; i < 12; i++) {
      trees.push({
        x: Math.random() * this.cw,
        y: Math.random() * this.ch,
        scale: 0.3 + Math.random() * 0.3,
        layer: 0,
        speed: 0.15,
      });
    }
    // Near sides (flanking)
    for (let i = 0; i < 8; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      trees.push({
        x: side < 0 ? Math.random() * 60 : this.cw - Math.random() * 60,
        y: Math.random() * this.ch,
        scale: 0.6 + Math.random() * 0.5,
        layer: 1,
        speed: 0.4,
      });
    }
    return trees;
  }

  startLevel(levelNum, endless = false) {
    this.isEndless = endless;
    this.level = levelNum;
    const seed = this.useDailySeed ? this.dailySeed + levelNum * 7 : Date.now() + levelNum;
    this.rng = new SeededRNG(seed);

    const levelIdx = Math.min(levelNum - 1, LEVEL_LENGTHS.length - 1);
    this.levelLength = endless ? 99999 : (LEVEL_LENGTHS[levelIdx] || 3000);

    const character = CHARACTERS[this.selectedCharIdx];
    const playerX = this.lanePositions[2];
    const playerY = this.ch - 100;

    this.player = new Player(playerX, playerY, character, this.attributesMode);
    this.player.applyLanePositions(this.lanePositions);

    // Apply upgrades
    this._applyUpgrades();

    this.owl = new Owl(this.cw, this.ch);
    this.owl.threat = 0.1;

    const difficulty = Math.min(levelNum, 8);
    this.spawner = new Spawner(this.cw, this.ch, this.lanePositions, this.rng);
    this.spawner.spawnY = -80;

    this.obstacles = [];
    this.pickups = [];
    this.npcs = [];
    this.footprintsWorld = [];

    this.distance = 0;
    this.score = 0;
    this.streak = 1;
    this.cleanStreak = 0;
    this.time = 0;
    this.swoopsDodged = 0;
    this.npcsSaved = 0;
    this.runHits = 0;

    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;

    this.stunOverlayAlpha = 0;
    this.wasInShadow = false;
    this.shadowDodgeTimer = 0;

    this.eventTimer = 20000 + Math.random() * 10000;
    this.auroraActive = false;
    this.blizzardActive = false;
    this.auroraTimer = 0;
    this.blizzardTimer = 0;

    this.npcSnatchTimer = 6000 + Math.random() * 6000;

    this.state = 'playing';
    this.audio.resume();
    this.audio.startAmbientMusic();
  }

  _applyUpgrades() {
    if (!this.player) return;
    for (const upg of this.upgrades) {
      switch (upg) {
        case 'long_jump':
          this.player.hangMultiplier *= 1.2;
          break;
        case 'fast_recovery':
          this.player.stunMult *= 0.75;
          break;
        case 'dash_cooldown':
          this.player.dashCooldownMax *= 0.8;
          break;
        case 'small_hitbox':
          this.player.w -= 4;
          break;
        case 'more_pickups':
          this.spawner.pickupInterval *= 0.7;
          break;
      }
    }
  }

  update(dt) {
    if (dt > 0.1) dt = 0.1; // Cap delta

    switch (this.state) {
      case 'playing': this._updatePlaying(dt); break;
      case 'paused': this._updatePaused(); break;
    }

    this.hud.update(dt);

    // Snowflakes always update
    this._updateSnow(dt);
  }

  _updatePlaying(dt) {
    const dtMs = dt * 1000;
    const inp = this.input;

    if (inp.wasPressed('Escape')) {
      this.state = 'paused';
      this.pauseMenuIdx = 0;
      return;
    }

    const player = this.player;
    const difficulty = Math.min(this.level, 8);

// --- Input ---
// Lane movement (buffered)
const leftPressed = inp.consumeAnyBuffer('KeyA', 'ArrowLeft', 'TouchLeft');
const rightPressed = inp.consumeAnyBuffer('KeyD', 'ArrowRight', 'TouchRight');
if (leftPressed) player.moveLeft();
if (rightPressed) player.moveRight();

// Jump
if (inp.consumeAnyBuffer('Space', 'TouchUp')) {
  player.jump(this.audio);
}

// Dash
if (inp.anyPressed('ShiftLeft', 'ShiftRight')) {
  player.dash(this.audio);
}

    // Axe (already handled during collision, but consumed here if pressed manually)
    // Pre-arm axe is automatic in collision system

    // --- Player update ---
    player.update(dt, this.lanePositions);

    // Footprints in world
    if (!player.jumping && player.footprints.length > 0) {
      const lastFP = player.footprints[player.footprints.length - 1];
      this.footprintsWorld.push({
        x: lastFP.x,
        y: this.ch - 110 + Math.random() * 5,
        alpha: 0.5,
        lane: player.lane,
      });
      if (this.footprintsWorld.length > 30) this.footprintsWorld.shift();
    }
    for (const fp of this.footprintsWorld) {
      fp.alpha -= dt * 0.5;
      fp.y -= player.speed * dt; // Scroll with world
    }
    this.footprintsWorld = this.footprintsWorld.filter(fp => fp.alpha > 0);

    // --- Scroll world ---
    // Player stays fixed near bottom (y = ch-100). Obstacles spawn at top (y = -80) 
    // and scroll DOWN toward player as the world moves.
    const scrollAmt = player.speed * dt;
    this.distance += scrollAmt / 3; // ~3px per meter
    this.time += dtMs;

    // Obstacles: scroll down + update projectiles/state
    for (const obs of this.obstacles) {
      obs.y += scrollAmt; // Move toward player (down the screen)
      obs.updateProjectiles(dt, player.y);
    }
    this.obstacles = this.obstacles.filter(obs => obs.active && obs.y < this.ch + 120);

    // Pickups: scroll down
    for (const p of this.pickups) {
      if (!p.collected) p.y += scrollAmt;
      p.bobPhase += dt * 2;
      if (p.collected) {
        p.collectTimer += dt * 1000;
        if (p.collectTimer >= p.collectDuration) p.active = false;
      }
    }
    this.pickups = this.pickups.filter(p => p.active && p.y < this.ch + 80);

    // NPCs: scroll down
    for (const npc of this.npcs) {
      if (!npc.snatched) npc.y += scrollAmt;
      npc.update(dt);
    }
    this.npcs = this.npcs.filter(n => n.active);

    // --- Spawning ---
    const hasShadow = this.owl.shadows.length > 0;
    const pickupFreq = this.attributesMode ? (CHARACTERS[this.selectedCharIdx].stats.pickupFreqMult || 1) : 1;
    this.spawner.update(dt, difficulty, this.obstacles, this.pickups, this.npcs,
      player.speed, player.y, pickupFreq, hasShadow);

    // --- Owl ---
    const shadowWarnMult = this.attributesMode ? (CHARACTERS[this.selectedCharIdx].stats.shadowWarningMult || 1) : 1;
    this.owl.update(dt, player.x, player.y, player.lane, this.lanePositions, difficulty, shadowWarnMult, this.audio);

    // Owl threat based on player performance
    if (player.stunned) {
      this.owl.increaseThreat(dt * 0.08);
    } else if (!player.dashing) {
      this.owl.decreaseThreat(dt * 0.012);
    } else {
      this.owl.decreaseThreat(dt * 0.025);
    }

    // Track shadow zone
    const playerHB = player.getHitbox();
    const inShadow = this.owl.isPlayerInShadow(playerHB);
    if (inShadow) {
      this.owl.increaseThreat(dt * 0.06);
      this.shadowDodgeTimer += dtMs;
    }
    if (this.wasInShadow && !inShadow && this.shadowDodgeTimer > 200) {
      // Successfully dodged shadow
      this.swoopsDodged++;
      this.player.swoopsDodged++;
      this.streak = Math.min(this.streak + 0.2, 8);
      this.hud.addScorePopup(player.x, player.y - 60, 'SWOOP DODGED! +50', '#74b9ff');
      this.score += 50;
      this.shadowDodgeTimer = 0;
    }
    this.wasInShadow = inShadow;

    // --- Collisions ---
    const hits = this.collision.checkObstacles(player, this.obstacles, this.audio);
    for (const hit of hits) {
      if (hit.type === 'stun') {
        this.runHits++;
        this.streak = Math.max(1, this.streak - 0.5);
        this.cleanStreak = 0;
        this.owl.increaseThreat(0.12);
        this.shakeMag = 6;
        this.shakeDuration = 400;
        this.stunOverlayAlpha = 0.4;
      } else if (hit.type === 'chop') {
        this.totalChopped++;
        saveData('totalChopped', this.totalChopped);
        this.hud.addScorePopup(player.x, player.y - 50, 'CHOPPED! +25', '#f1c40f');
        this.score += 25;
      } else if (hit.type === 'ice') {
        // Slow steering - already handled in player
        this.player.lerpSpeed = 4; // Reduced temporarily
        setTimeout(() => { if (this.player) this.player.lerpSpeed = 8; }, 1500);
      }
    }

    // Pickups
    const collected = this.collision.checkPickups(player, this.pickups, this.audio);
    for (const p of collected) {
      this._applyPickup(p.type);
      this.hud.addScorePopup(player.x, player.y - 55, `+${PICKUP_INFO[p.type].label}!`, PICKUP_INFO[p.type].color);
    }

    // Swoop capture check
    if (this.collision.checkOwlCapture(player, this.owl)) {
      this._gameOver('captured');
      return;
    }

    // Owl capture: threat reaches 1
    if (this.owl.threat >= 1.0) {
      this._gameOver('caught');
      return;
    }

    // NPC snatch
    this.npcSnatchTimer -= dtMs;
    if (this.npcSnatchTimer <= 0) {
      this._trySnatchNPC();
      this.npcSnatchTimer = 5000 + Math.random() * 8000;
    }

    // Screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dtMs;
      this.shakeX = (Math.random() - 0.5) * this.shakeMag;
      this.shakeY = (Math.random() - 0.5) * this.shakeMag;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Stun overlay fade
    this.stunOverlayAlpha -= dt * 1.5;
    this.stunOverlayAlpha = Math.max(0, this.stunOverlayAlpha);

    // Score update
    const scoreMult = this.attributesMode ? (CHARACTERS[this.selectedCharIdx].stats.scoreMult || 1) : 1;
    this.score += Math.floor(player.speed * dt * 0.1 * this.streak * scoreMult);

    // Clean run streak
    if (hits.length === 0 && !player.stunned) {
      this.cleanStreak += dt;
      if (this.cleanStreak > 3) {
        this.streak = Math.min(this.streak + dt * 0.05, 8);
      }
    }

    // Special events
    this.eventTimer -= dtMs;
    if (this.eventTimer <= 0 && !this.auroraActive && !this.blizzardActive) {
      this._triggerEvent();
      this.eventTimer = 20000 + Math.random() * 20000;
    }
    if (this.auroraActive) {
      this.auroraTimer -= dtMs;
      if (this.auroraTimer <= 0) this.auroraActive = false;
      this.score += Math.floor(dt * 20);
    }
    if (this.blizzardActive) {
      this.blizzardTimer -= dtMs;
      if (this.blizzardTimer <= 0) this.blizzardActive = false;
    }

    // Background scroll
    this.bgScrollY += player.speed * dt * 0.5;

    // Level complete
    if (this.distance >= this.levelLength) {
      this._levelComplete();
    }
  }

  _applyPickup(type) {
    const p = this.player;
    switch (type) {
      case PICKUP_TYPES.FEATHER_AXE:
        p.hasAxe = true;
        break;
      case PICKUP_TYPES.WIND_GUST:
        p.speed = p.baseSpeed * 1.5;
        p.dashing = true;
        p.dashTimer = 2000;
        this.owl.decreaseThreat(0.1);
        break;
      case PICKUP_TYPES.HOT_COCOA:
        p.stunMult = Math.max(0.3, p.stunMult * 0.6);
        break;
      case PICKUP_TYPES.LANTERN_CHARM:
        // Shorten next shadow (handled in owl)
        this.owl.shadowWarningDuration = Math.min(this.owl.shadowWarningDuration, 1200);
        setTimeout(() => { if (this.owl) this.owl.shadowWarningDuration = 2000; }, 10000);
        break;
      case PICKUP_TYPES.LUCKY_BELL:
        this.spawner.obstacleInterval *= 1.3;
        setTimeout(() => { if (this.spawner) this.spawner.obstacleInterval /= 1.3; }, 8000);
        break;
    }
  }

  _trySnatchNPC() {
    const activeNPCs = this.npcs.filter(n => n.active && !n.snatched);
    if (activeNPCs.length === 0) return;
    const victim = activeNPCs[Math.floor(Math.random() * activeNPCs.length)];
    victim.snatch(this.audio);
    this.audio.playOwlScreech(0.8);
    // Visual swoop line
    this.owl.swoopLines.push({
      x: victim.x,
      y: victim.y - 300,
      x2: victim.x,
      y2: victim.y,
      alpha: 0.8
    });
  }

  _triggerEvent() {
    if (Math.random() < 0.5) {
      this.auroraActive = true;
      this.auroraTimer = 12000;
    } else {
      this.blizzardActive = true;
      this.blizzardTimer = 10000;
      // Blizzard: faster pickups
      this.spawner.pickupInterval *= 0.5;
      setTimeout(() => { if (this.spawner) this.spawner.pickupInterval *= 2; }, 10000);
    }
  }

  _levelComplete() {
    this.state = 'levelcomplete';
    this.audio.playLevelComplete();
    this.audio.stopAmbientMusic();
    this.owl.cancelSwoop();

    // Save best score
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveData('bestScore', this.bestScore);
    }

    // Check achievements
    this._checkAchievements();

    // Prepare upgrade options
    const available = [...UPGRADES].filter(u => !this.upgrades.includes(u.id) || true);
    const shuffled = available.sort(() => Math.random() - 0.5);
    this.upgradeOptions = shuffled.slice(0, 3);
    this.selectedUpgradeIdx = 0;

    setTimeout(() => {
      if (this.state === 'levelcomplete') this.state = 'upgrade';
    }, 2000);
  }

  _gameOver(reason) {
    this.state = 'gameover';
    this.audio.playOwlCapture();
    this.audio.stopAmbientMusic();
    this.owl.cancelSwoop();

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      saveData('bestScore', this.bestScore);
    }

    this._checkAchievements();
  }

  _checkAchievements() {
    const achs = this.achievements;
    if (this.runHits === 0 && !achs.no_stun) {
      achs.no_stun = true;
    }
    if (this.swoopsDodged >= 10) achs.shadow_dancer = true;
    if (this.totalChopped >= 20) achs.lumberjack = true;
    saveData('achievements', achs);
  }

  _updatePaused() {
    const inp = this.input;
    if (inp.wasPressed('Escape')) {
      this.state = 'playing';
      return;
    }
    if (inp.wasPressed('ArrowUp') || inp.wasPressed('KeyW')) {
      this.pauseMenuIdx = Math.max(0, this.pauseMenuIdx - 1);
    }
    if (inp.wasPressed('ArrowDown') || inp.wasPressed('KeyS')) {
      this.pauseMenuIdx = Math.min(2, this.pauseMenuIdx + 1);
    }
    if (inp.wasPressed('Enter') || inp.wasPressed('Space')) {
      switch (this.pauseMenuIdx) {
        case 0: this.state = 'playing'; break;
        case 1: this.startLevel(this.level); break;
        case 2: this.state = 'title'; break;
      }
    }
  }

  // ============================================================
  // DRAWING
  // ============================================================

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);

    switch (this.state) {
      case 'title': this._drawTitle(ctx); break;
      case 'charselect': this._drawCharSelect(ctx); break;
      case 'howtoplay': this._drawHowToPlay(ctx); break;
      case 'settings': this._drawSettings(ctx); break;
      case 'playing':
      case 'paused':
        this._drawGame(ctx);
        if (this.state === 'paused') this._drawPauseMenu(ctx);
        break;
      case 'levelcomplete':
        this._drawGame(ctx);
        this._drawLevelComplete(ctx);
        break;
      case 'upgrade': this._drawUpgrade(ctx); break;
      case 'gameover': this._drawGameOver(ctx); break;
    }
  }

  _drawGame(ctx) {
    ctx.save();
    if (this.shakeMag > 0 && this.shakeDuration > 0) {
      ctx.translate(this.shakeX, this.shakeY);
    }

    // Sky gradient
    this._drawSky(ctx);

    // Aurora
    if (this.auroraActive) this._drawAurora(ctx);

    // Background trees
    this._drawBgTrees(ctx);

    // Snow ground
    this._drawGround(ctx);

    // Lane cues (subtle)
    this._drawLaneCues(ctx);

    // Footprints
    this._drawFootprints(ctx);

    // Owl effects
    this.owl.draw(ctx, this.cw, this.ch);

    // NPCs
    for (const npc of this.npcs) npc.draw(ctx);

    // Obstacles
    for (const obs of this.obstacles) obs.draw(ctx);

    // Pickups
    for (const p of this.pickups) p.draw(ctx);

    // Player
    this.player.draw(ctx);

    // Blizzard overlay
    if (this.blizzardActive) this._drawBlizzard(ctx);

    // Snow
    this._drawSnow(ctx);

    // Stun overlay
    if (this.stunOverlayAlpha > 0) {
      ctx.fillStyle = `rgba(100,150,255,${this.stunOverlayAlpha})`;
      ctx.fillRect(0, 0, this.cw, this.ch);
    }

    // Vignette
    this._drawVignette(ctx);

    ctx.restore();

    // HUD (no shake)
    this.hud.draw(ctx, {
      distance: this.distance,
      levelLength: this.levelLength,
      speed: this.player.speed,
      score: this.score,
      streak: this.streak,
      owl: this.owl,
      player: this.player,
      level: this.level,
      swoopsDodged: this.swoopsDodged,
      auroraActive: this.auroraActive,
      blizzardActive: this.blizzardActive,
    });
  }

  _drawSky(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    if (this.blizzardActive) {
      grad.addColorStop(0, '#1a2a3a');
      grad.addColorStop(1, '#2a3a4a');
    } else {
      grad.addColorStop(0, '#0a0e1a');
      grad.addColorStop(0.4, '#1a2040');
      grad.addColorStop(1, '#2a3050');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
  }

  _drawAurora(ctx) {
    const t = Date.now() * 0.0005;
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 3; i++) {
      const y = 80 + i * 40;
      const grad = ctx.createLinearGradient(0, y, this.cw, y + 60);
      grad.addColorStop(0, 'rgba(0,255,150,0)');
      grad.addColorStop(0.3 + Math.sin(t + i) * 0.2, 'rgba(0,255,200,0.6)');
      grad.addColorStop(0.6 + Math.cos(t * 0.7 + i) * 0.2, 'rgba(100,200,255,0.4)');
      grad.addColorStop(1, 'rgba(150,100,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y + Math.sin(t * 1.2 + i * 0.8) * 20, this.cw, 80);
    }
    ctx.restore();
  }

  _drawBgTrees(ctx) {
    const scrollFar = (this.bgScrollY * 0.08) % this.ch;
    const scrollNear = (this.bgScrollY * 0.25) % this.ch;

    for (const tree of this.bgTrees) {
      const scroll = tree.layer === 0 ? scrollFar : scrollNear;
      const ty = ((tree.y + scroll) % this.ch);
      this._drawBgTree(ctx, tree.x, ty, tree.scale, tree.layer);
    }
  }

  _drawBgTree(ctx, x, y, scale, layer) {
    ctx.save();
    ctx.globalAlpha = layer === 0 ? 0.25 : 0.45;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Trunk
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(-5, -20, 10, 20);

    // Tiers
    const color = '#1a3510';
    [[30, 24], [24, 20], [18, 16]].forEach(([w, h], i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -40 - i * 16 - h);
      ctx.lineTo(-w / 2, -40 - i * 16);
      ctx.lineTo(w / 2, -40 - i * 16);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
  }

  _drawGround(ctx) {
    // Snow ground
    const grad = ctx.createLinearGradient(0, this.ch - 140, 0, this.ch);
    grad.addColorStop(0, '#d0e8f4');
    grad.addColorStop(1, '#e8f4fb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, this.ch - 130, this.cw, 130);

    // Ground edge (snowbank)
    ctx.fillStyle = '#f0f8ff';
    ctx.beginPath();
    for (let x = 0; x <= this.cw; x += 20) {
      const h = 8 + Math.sin(x * 0.05 + this.bgScrollY * 0.01) * 4;
      if (x === 0) ctx.moveTo(x, this.ch - 130 + h);
      else ctx.lineTo(x, this.ch - 130 + h);
    }
    ctx.lineTo(this.cw, this.ch - 100);
    ctx.lineTo(0, this.ch - 100);
    ctx.closePath();
    ctx.fill();
  }

  _drawLaneCues(ctx) {
    // Subtle lane cues: fence posts at lane positions
    for (let i = 0; i < LANE_COUNT; i++) {
      const lx = this.lanePositions[i];

      // Far background "post" markers (very faint)
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#cce8f5';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 12]);
      ctx.beginPath();
      ctx.moveTo(lx, 120);
      ctx.lineTo(lx, this.ch - 130);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Lane snow texture: slightly different brightness per lane area
    for (let i = 0; i < LANE_COUNT - 1; i++) {
      const x1 = this.lanePositions[i];
      const x2 = this.lanePositions[i + 1];
      const mid = (x1 + x2) / 2;
      ctx.save();
      ctx.globalAlpha = i % 2 === 0 ? 0.04 : 0.0;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x1 - 15, this.ch - 130, x2 - x1 + 30, 130);
      ctx.restore();
    }
  }

  _drawFootprints(ctx) {
    for (const fp of this.footprintsWorld) {
      ctx.save();
      ctx.globalAlpha = fp.alpha * 0.5;
      ctx.fillStyle = '#b8d4e8';
      const fw = 6, fh = 9;
      ctx.beginPath();
      ctx.ellipse(fp.x - 4, fp.y, fw / 2, fh / 2, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fp.x + 4, fp.y - 5, fw / 2, fh / 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawBlizzard(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#c8e8f8';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
  }

  _drawSnow(ctx) {
    for (const flake of this.snowflakes) {
      ctx.save();
      ctx.globalAlpha = flake.alpha * (this.blizzardActive ? 1.5 : 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawVignette(ctx) {
    const grad = ctx.createRadialGradient(
      this.cw / 2, this.ch / 2, this.ch * 0.3,
      this.cw / 2, this.ch / 2, this.ch * 0.8
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
  }

  _updateSnow(dt) {
    for (const flake of this.snowflakes) {
      flake.wobble += dt * 1.5;
      flake.y += flake.vy * dt * (this.blizzardActive ? 2 : 1);
      flake.x += flake.vx * dt + Math.sin(flake.wobble) * 0.5;
      if (this.blizzardActive) {
        flake.x -= 60 * dt;
      }
      if (flake.y > this.ch) { flake.y = -5; flake.x = Math.random() * this.cw; }
      if (flake.x > this.cw) flake.x = 0;
      if (flake.x < 0) flake.x = this.cw;
    }
  }

  // ============================================================
  // UI SCREENS
  // ============================================================

  _drawTitle(ctx) {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0f1828');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
    this._drawSnow(ctx);
    this._drawAuroraStatic(ctx);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#a0c8ff';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 52px "Courier New"';
    ctx.fillText('SNOW OWL CHASE', this.cw / 2, 160);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.font = '16px "Courier New"';
    ctx.fillText('survive the hunt', this.cw / 2, 195);

    // Owl silhouette
    this._drawOwlSilhouette(ctx, this.cw / 2, 280, 1.2 + Math.sin(Date.now() * 0.001) * 0.05);

    // Menu
    const items = ['▶  PLAY', '◆  CHARACTER SELECT', '?  HOW TO PLAY', '⚙  SETTINGS'];
    items.forEach((item, i) => {
      const y = 380 + i * 52;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(this.cw / 2 - 150, y - 26, 300, 40, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,210,255,0.9)';
      ctx.font = '18px "Courier New"';
      ctx.fillText(item, this.cw / 2, y);
    });

    ctx.fillStyle = 'rgba(150,180,220,0.5)';
    ctx.font = '12px "Courier New"';
    ctx.fillText('[ CLICK TO SELECT ]', this.cw / 2, this.ch - 30);

    this._drawVignette(ctx);
  }

  _drawAuroraStatic(ctx) {
    const t = Date.now() * 0.0003;
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 3; i++) {
      const grad = ctx.createLinearGradient(0, 60 + i * 30, this.cw, 120 + i * 30);
      grad.addColorStop(0, 'rgba(0,200,150,0)');
      grad.addColorStop(0.5, 'rgba(0,255,200,0.8)');
      grad.addColorStop(1, 'rgba(100,150,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 50 + i * 30 + Math.sin(t + i) * 15, this.cw, 50);
    }
    ctx.restore();
  }

  _drawOwlSilhouette(ctx, cx, cy, scale = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = 'rgba(200,220,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    const wingFlap = Math.sin(Date.now() * 0.002) * 20;
    ctx.fillStyle = 'rgba(180,210,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(-70, wingFlap, 50, 20, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(70, wingFlap, 50, 20, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003) * 0.2;
    ctx.fillStyle = 'rgba(255,200,50,0.8)';
    ctx.beginPath();
    ctx.arc(-16, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, -10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawCharSelect(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
    this._drawSnow(ctx);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 28px "Courier New"';
    ctx.fillText('SELECT RUNNER', this.cw / 2, 50);

    ctx.fillStyle = 'rgba(150,200,255,0.6)';
    ctx.font = '11px "Courier New"';
    ctx.fillText('each character has unique perks', this.cw / 2, 72);

    const cardW = 140;
    const cardH = 240;
    const gap = 16;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = (this.cw - totalW) / 2;

    CHARACTERS.forEach((char, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = 190;
      const selected = i === this.charSelectIdx;

      ctx.save();
      if (selected) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = char.color;
        ctx.translate(0, -10);
      }

      // Card background
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = selected ? char.color : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      // Character preview
      this._drawCharPreview(ctx, char, cx, cy - 30);

      // Name
      ctx.fillStyle = char.color;
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.fillText(char.name.replace('The ', ''), cx, cy + 65);

      // Perk
      ctx.fillStyle = 'rgba(150,230,150,0.8)';
      ctx.font = '9px "Courier New"';
      const perkLines = this._wrapText(char.perk, 13);
      perkLines.forEach((line, li) => ctx.fillText(line, cx, cy + 82 + li * 13));

      // Tradeoff
      ctx.fillStyle = 'rgba(255,150,150,0.7)';
      const tradeLines = this._wrapText(char.tradeoff, 13);
      tradeLines.forEach((line, li) => ctx.fillText(line, cx, cy + 108 + li * 13));

      ctx.restore();
    });

    // Attributes mode toggle
    const attrY = this.ch - 90;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(this.cw / 2 - 160, attrY - 15, 320, 32, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,230,255,0.8)';
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(`ATTRIBUTE MODE: ${this.attributesMode ? 'ON ✓' : 'OFF ✗'}  [TAB to toggle]`, this.cw / 2, attrY + 4);

    // Confirm button
    const btnY = this.ch - 45;
    ctx.fillStyle = CHARACTERS[this.charSelectIdx].color;
    ctx.beginPath();
    ctx.roundRect(this.cw / 2 - 100, btnY - 18, 200, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Courier New"';
    ctx.fillText('CONFIRM [ENTER]', this.cw / 2, btnY + 2);

    this._drawVignette(ctx);
  }

  _drawCharPreview(ctx, char, cx, cy) {
    ctx.save();
    ctx.scale(1.4, 1.4);
    const sx = cx / 1.4;
    const sy = cy / 1.4;

    // Legs
    ctx.fillStyle = char.color;
    ctx.fillRect(sx - 9, sy - 8, 7, 16);
    ctx.fillRect(sx + 2, sy - 8, 7, 16);
    // Body
    ctx.beginPath();
    ctx.roundRect(sx - 12, sy - 34, 24, 28, 4);
    ctx.fill();
    // Scarf
    ctx.fillStyle = char.scarfColor;
    ctx.fillRect(sx - 13, sy - 24, 26, 7);
    // Head
    ctx.fillStyle = char.color;
    ctx.beginPath();
    ctx.arc(sx, sy - 42, 11, 0, Math.PI * 2);
    ctx.fill();

    // Hat (reuse player hat logic)
    ctx.fillStyle = char.scarfColor;
    switch (char.hatType) {
      case 'beanie':
        ctx.beginPath();
        ctx.roundRect(sx - 10, sy - 55, 20, 12, [6, 6, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy - 55, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tophat':
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(sx - 7, sy - 65, 14, 18);
        ctx.fillRect(sx - 12, sy - 48, 24, 4);
        break;
      case 'hood':
        ctx.beginPath();
        ctx.arc(sx, sy - 47, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(sx - 14, sy - 47, 28, 6);
        break;
      case 'cap':
        ctx.beginPath();
        ctx.roundRect(sx - 10, sy - 55, 20, 8, [4, 4, 0, 0]);
        ctx.fill();
        ctx.fillRect(sx - 14, sy - 48, 22, 3);
        break;
    }
    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(sx - 5, sy - 46, 3, 3);
    ctx.fillRect(sx + 2, sy - 46, 3, 3);

    ctx.restore();
  }

  _wrapText(text, maxLen) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + w).length > maxLen) {
        if (cur) lines.push(cur.trim());
        cur = w + ' ';
      } else {
        cur += w + ' ';
      }
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }

  _drawHowToPlay(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 24px "Courier New"';
    ctx.fillText('HOW TO PLAY', this.cw / 2, 55);

    const lines = [
      ['MOVEMENT', 'A/D or ← → to swap lanes'],
      ['JUMP', 'SPACE to jump over logs, branches, snowballs'],
      ['DASH', 'SHIFT for speed dash (creates owl distance)'],
      ['FEATHER AXE', '1 or F to chop a tree on collision'],
      ['', ''],
      ['OWL THREAT', 'Hits and slow play increase the threat bar'],
      ['SWOOP ATTACK', 'SHADOW WARNING appears - exit shadow zone fast!'],
      ['CAPTURE', 'Swoop hit or threat bar maxes out = caught'],
      ['', ''],
      ['PICKUPS', '🪓 Feather Axe  💨 Wind Gust  ☕ Hot Cocoa'],
      ['', '🏮 Lantern Charm  🔔 Lucky Bell'],
      ['', ''],
      ['OBSTACLES', 'Logs: JUMP  Trees: dodge or AXE  Snowmen: dodge'],
      ['', 'Rolling Snowballs: JUMP  Ice Patches: slow steering'],
      ['', 'Thin Ice: cracks+slows  Branch: JUMP  Snowdrift: slow'],
      ['', ''],
      ['NPCs', 'Runner NPCs may get snatched by the owl (dramatic!)'],
    ];

    let y = 95;
    ctx.textAlign = 'left';
    for (const [label, text] of lines) {
      if (!label && !text) { y += 4; continue; }
      if (label) {
        ctx.fillStyle = '#74b9ff';
        ctx.font = 'bold 11px "Courier New"';
        ctx.fillText(label, this.cw / 2 - 230, y);
      }
      ctx.fillStyle = 'rgba(200,230,255,0.8)';
      ctx.font = '11px "Courier New"';
      ctx.fillText(text, this.cw / 2 - 90, y);
      y += 20;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#74b9ff';
    ctx.font = '13px "Courier New"';
    ctx.fillText('[BACKSPACE / ESC to go back]', this.cw / 2, this.ch - 30);

    this._drawVignette(ctx);
  }

  _drawSettings(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 24px "Courier New"';
    ctx.fillText('SETTINGS', this.cw / 2, 55);

    const settings = [
      `AUDIO: ${this.audio.enabled ? 'ON ✓' : 'OFF ✗'}  [A]`,
      `ATTRIBUTE MODE: ${this.attributesMode ? 'ON ✓' : 'OFF ✗'}  [M]`,
      `DAILY SEED MODE: ${this.useDailySeed ? 'ON ✓' : 'OFF ✗'}  [D]`,
      `TODAY'S SEED: ${this.dailySeed}`,
      `BEST SCORE: ${this.bestScore.toLocaleString()}`,
      '',
      `ACHIEVEMENTS:`,
      `  No Stun Run: ${this.achievements.no_stun ? '✓ UNLOCKED' : '○ locked'}`,
      `  Shadow Dancer (10 dodges): ${this.achievements.shadow_dancer ? '✓ UNLOCKED' : '○ locked'}`,
      `  Lumberjack (20 chops): ${this.achievements.lumberjack ? '✓ UNLOCKED' : '○ locked'}`,
    ];

    settings.forEach((line, i) => {
      if (!line) return;
      ctx.fillStyle = line.startsWith('  ') ? 'rgba(200,230,200,0.7)' : 'rgba(200,230,255,0.9)';
      ctx.font = '13px "Courier New"';
      ctx.fillText(line, this.cw / 2, 110 + i * 32);
    });

    ctx.fillStyle = '#74b9ff';
    ctx.font = '13px "Courier New"';
    ctx.fillText('[BACKSPACE / ESC to go back]', this.cw / 2, this.ch - 30);

    this._drawVignette(ctx);
  }

  _drawPauseMenu(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.cw, this.ch);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 30px "Courier New"';
    ctx.fillText('PAUSED', this.cw / 2, this.ch / 2 - 80);

    const items = ['RESUME', 'RESTART', 'QUIT TO MENU'];
    items.forEach((item, i) => {
      const selected = i === this.pauseMenuIdx;
      ctx.fillStyle = selected ? 'rgba(116,185,255,0.9)' : 'rgba(200,230,255,0.5)';
      ctx.font = selected ? 'bold 20px "Courier New"' : '18px "Courier New"';
      ctx.fillText(selected ? `> ${item} <` : item, this.cw / 2, this.ch / 2 - 20 + i * 44);
    });
  }

  _drawLevelComplete(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.cw, this.ch);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#74b9ff';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 40px "Courier New"';
    ctx.fillText('LEVEL COMPLETE!', this.cw / 2, this.ch / 2 - 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(200,230,255,0.7)';
    ctx.font = '16px "Courier New"';
    ctx.fillText(`Score: ${this.score.toLocaleString()}`, this.cw / 2, this.ch / 2 + 20);
    ctx.fillText(`Distance: ${Math.floor(this.distance)}m`, this.cw / 2, this.ch / 2 + 45);
  }

  _drawUpgrade(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#050810');
    grad.addColorStop(1, '#0a1824');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
    this._drawSnow(ctx);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 26px "Courier New"';
    ctx.fillText('CHOOSE UPGRADE', this.cw / 2, 70);
    ctx.fillStyle = 'rgba(150,200,255,0.6)';
    ctx.font = '13px "Courier New"';
    ctx.fillText('select one to enhance your next run', this.cw / 2, 95);

    // Stats summary
    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.font = '11px "Courier New"';
    ctx.fillText(`Score: ${this.score.toLocaleString()} | Distance: ${Math.floor(this.distance)}m | Hits: ${this.runHits} | Swoops Dodged: ${this.swoopsDodged}`, this.cw / 2, 120);

    const cardW = 200;
    const cardH = 150;
    const gap = 20;
    const totalW = this.upgradeOptions.length * cardW + (this.upgradeOptions.length - 1) * gap;
    const startX = (this.cw - totalW) / 2;

    this.upgradeOptions.forEach((upg, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = this.ch / 2;
      const selected = i === this.selectedUpgradeIdx;

      ctx.save();
      if (selected) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#74b9ff';
        ctx.translate(0, -8);
      }

      ctx.fillStyle = selected ? 'rgba(116,185,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = selected ? '#74b9ff' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.fillText(upg.icon, cx, cy - 30);
      ctx.fillStyle = '#e8f4ff';
      ctx.font = 'bold 14px "Courier New"';
      ctx.fillText(upg.name, cx, cy);
      ctx.fillStyle = 'rgba(180,230,180,0.8)';
      ctx.font = '11px "Courier New"';
      const descLines = this._wrapText(upg.desc, 20);
      descLines.forEach((l, li) => ctx.fillText(l, cx, cy + 22 + li * 15));

      ctx.restore();
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#74b9ff';
    ctx.font = '13px "Courier New"';
    ctx.fillText('← → to select   [ENTER] to confirm', this.cw / 2, this.ch - 60);

    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.font = '11px "Courier New"';
    ctx.fillText(`[N] Skip upgrade and continue`, this.cw / 2, this.ch - 35);

    this._drawVignette(ctx);
  }

  _drawGameOver(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.ch);
    grad.addColorStop(0, '#0a0000');
    grad.addColorStop(1, '#1a0808');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.cw, this.ch);
    this._drawSnow(ctx);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff4444';
    ctx.fillStyle = '#ffd0d0';
    ctx.font = 'bold 44px "Courier New"';
    ctx.fillText('CAUGHT!', this.cw / 2, 130);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,200,200,0.6)';
    ctx.font = '16px "Courier New"';
    ctx.fillText('The snow owl got you...', this.cw / 2, 165);

    // Stats card
    const stats = [
      ['Score', this.score.toLocaleString()],
      ['Best Score', this.bestScore.toLocaleString()],
      ['Distance', `${Math.floor(this.distance)}m`],
      ['Time', formatTime(this.time)],
      ['Hits Taken', this.runHits],
      ['Swoops Dodged', this.swoopsDodged],
      ['Character', CHARACTERS[this.selectedCharIdx].name],
    ];

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(this.cw / 2 - 180, 200, 360, stats.length * 32 + 20, 12);
    ctx.fill();

    stats.forEach(([label, value], i) => {
      ctx.fillStyle = 'rgba(200,230,255,0.6)';
      ctx.font = '13px "Courier New"';
      ctx.textAlign = 'left';
      ctx.fillText(label, this.cw / 2 - 160, 228 + i * 32);
      ctx.fillStyle = '#e8f4ff';
      ctx.font = 'bold 13px "Courier New"';
      ctx.textAlign = 'right';
      ctx.fillText(value, this.cw / 2 + 160, 228 + i * 32);
    });

    const btnY = this.ch - 80;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(this.cw / 2 - 110, btnY - 18, 100, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillText('[R] RETRY', this.cw / 2 - 60, btnY + 2);

    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(this.cw / 2 + 10, btnY - 18, 100, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('[M] MENU', this.cw / 2 + 60, btnY + 2);

    this._drawVignette(ctx);
  }

  // ============================================================
  // INPUT HANDLING FOR UI SCREENS
  // ============================================================

  handleUIInput() {
    const inp = this.input;
    switch (this.state) {
      case 'title':
        if (inp.wasPressed('Enter') || inp.wasPressed('Space') || inp.wasPressed('Digit1') || inp.wasPressed('KeyP')) {
          this.startLevel(this.level);
        }
        if (inp.wasPressed('Digit2') || inp.wasPressed('KeyC')) {
          this.state = 'charselect';
        }
        if (inp.wasPressed('Digit3') || inp.wasPressed('KeyH')) {
          this.state = 'howtoplay';
        }
        if (inp.wasPressed('Digit4') || inp.wasPressed('KeyS')) {
          this.state = 'settings';
        }
        break;

      case 'charselect':
        if (inp.wasPressed('ArrowLeft') || inp.wasPressed('KeyA')) {
          this.charSelectIdx = Math.max(0, this.charSelectIdx - 1);
        }
        if (inp.wasPressed('ArrowRight') || inp.wasPressed('KeyD')) {
          this.charSelectIdx = Math.min(CHARACTERS.length - 1, this.charSelectIdx + 1);
        }
        if (inp.wasPressed('Tab')) {
          this.attributesMode = !this.attributesMode;
          saveData('attributesMode', this.attributesMode);
        }
        if (inp.wasPressed('Enter') || inp.wasPressed('Space')) {
          this.selectedCharIdx = this.charSelectIdx;
          saveData('selectedChar', this.selectedCharIdx);
          this.state = 'title';
        }
        if (inp.wasPressed('Escape') || inp.wasPressed('Backspace')) {
          this.state = 'title';
        }
        break;

      case 'howtoplay':
      case 'settings':
        if (inp.wasPressed('Escape') || inp.wasPressed('Backspace') || inp.wasPressed('Enter')) {
          this.state = 'title';
        }
        if (this.state === 'settings') {
          if (inp.wasPressed('KeyA')) {
            this.audio.toggleEnabled();
          }
          if (inp.wasPressed('KeyM')) {
            this.attributesMode = !this.attributesMode;
            saveData('attributesMode', this.attributesMode);
          }
          if (inp.wasPressed('KeyD')) {
            this.useDailySeed = !this.useDailySeed;
          }
        }
        break;

      case 'upgrade':
        if (inp.wasPressed('ArrowLeft') || inp.wasPressed('KeyA')) {
          this.selectedUpgradeIdx = Math.max(0, this.selectedUpgradeIdx - 1);
        }
        if (inp.wasPressed('ArrowRight') || inp.wasPressed('KeyD')) {
          this.selectedUpgradeIdx = Math.min(this.upgradeOptions.length - 1, this.selectedUpgradeIdx + 1);
        }
        if (inp.wasPressed('Enter') || inp.wasPressed('Space')) {
          const chosen = this.upgradeOptions[this.selectedUpgradeIdx];
          this.upgrades.push(chosen.id);
          saveData('upgrades', this.upgrades);
          this.startLevel(this.level + 1);
        }
        if (inp.wasPressed('KeyN')) {
          this.startLevel(this.level + 1);
        }
        break;

      case 'gameover':
        if (inp.wasPressed('KeyR') || inp.wasPressed('Enter')) {
          this.upgrades = []; // reset upgrades on game over
          saveData('upgrades', this.upgrades);
          this.level = 1;
          this.startLevel(1);
        }
        if (inp.wasPressed('KeyM') || inp.wasPressed('Escape')) {
          this.state = 'title';
        }
        break;
    }
  }
}
