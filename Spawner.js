// ============================================================
// Spawner.js - Procedural spawning with fairness validation
// ============================================================

import { Obstacle, OBSTACLE_TYPES } from '../entities/Obstacle.js';
import { Pickup, PICKUP_TYPES } from '../entities/Pickup.js';
import { NPC } from '../entities/NPC.js';
import { SeededRNG } from '../utils.js';

const ALL_PICKUPS = Object.values(PICKUP_TYPES);
const OBSTACLE_LIST = [
  OBSTACLE_TYPES.LOG,
  OBSTACLE_TYPES.SNOWMAN,
  OBSTACLE_TYPES.TREE,
  OBSTACLE_TYPES.SNOWBALL,
  OBSTACLE_TYPES.ICE_PATCH,
  OBSTACLE_TYPES.THIN_ICE,
  OBSTACLE_TYPES.SNOWDRIFT,
  OBSTACLE_TYPES.BRANCH,
];

export class Spawner {
  constructor(canvasW, canvasH, lanePositions, rng) {
    this.cw = canvasW;
    this.ch = canvasH;
    this.lanePositions = lanePositions;
    this.rng = rng || new SeededRNG(Date.now());

    this.obstacleTimer = 0;
    this.obstacleInterval = 2200; // ms
    this.pickupTimer = 0;
    this.pickupInterval = 5000;
    this.npcTimer = 0;
    this.npcInterval = 8000;
    this.npcCount = 0;
    this.npcMax = 3;

    this.spawnY = -80; // Obstacles spawn above canvas, scroll DOWN toward player
  }

  update(dt, difficulty, obstacles, pickups, npcs, playerSpeed, playerY, pickupFreqMult = 1, hasActiveShadow = false) {
    const dtMs = dt * 1000;
    const diffMult = 1 + difficulty * 0.15;

    // Obstacle spawning
    this.obstacleTimer += dtMs;
    const interval = Math.max(900, this.obstacleInterval / diffMult);
    if (this.obstacleTimer >= interval) {
      this.obstacleTimer = 0;
      const newObs = this._spawnObstaclePattern(difficulty, playerSpeed, playerY, hasActiveShadow);
      obstacles.push(...newObs);
    }

    // Pickup spawning
    this.pickupTimer += dtMs;
    const pInterval = this.pickupInterval / pickupFreqMult;
    if (this.pickupTimer >= pInterval) {
      this.pickupTimer = 0;
      const pickup = this._spawnPickup(playerSpeed);
      if (pickup) pickups.push(pickup);
    }

    // NPC spawning
    this.npcTimer += dtMs;
    const activeNPCs = npcs.filter(n => n.active).length;
    if (this.npcTimer >= this.npcInterval && activeNPCs < this.npcMax) {
      this.npcTimer = 0;
      const npc = this._spawnNPC(playerSpeed, playerY);
      if (npc) npcs.push(npc);
    }
  }

  _spawnObstaclePattern(difficulty, playerSpeed, playerY, hasActiveShadow) {
    const patterns = this._getPatterns(difficulty);
    let pattern = this.rng.choice(patterns);

    // Fairness: if swoop active, pick a simpler pattern
    if (hasActiveShadow) {
      const safePatterns = patterns.filter(p => p.difficulty <= 1);
      if (safePatterns.length > 0) pattern = this.rng.choice(safePatterns);
    }

    // Validate that at least one lane is safe
    const occupied = pattern.lanes || [];
    const blockedLanes = new Set(occupied);
    if (blockedLanes.size >= 5) {
      // Remove the rightmost obstacle to ensure safety
      pattern = { ...pattern, lanes: [...occupied].slice(0, 4) };
    }

    return this._buildPattern(pattern, playerSpeed, playerY);
  }

  _getPatterns(difficulty) {
    const base = [
      // Single obstacles
      { type: OBSTACLE_TYPES.LOG, lanes: [this.rng.nextInt(0, 4)], difficulty: 0 },
      { type: OBSTACLE_TYPES.SNOWMAN, lanes: [this.rng.nextInt(0, 4)], difficulty: 0 },
      { type: OBSTACLE_TYPES.SNOWDRIFT, lanes: [this.rng.nextInt(0, 4)], difficulty: 0 },
      { type: OBSTACLE_TYPES.ICE_PATCH, lanes: [this.rng.nextInt(0, 4)], difficulty: 0 },
      { type: OBSTACLE_TYPES.BRANCH, lanes: [this.rng.nextInt(0, 4)], difficulty: 0 },
      // Multi-lane
      { type: OBSTACLE_TYPES.LOG, lanes: [0, 1, 2], difficulty: 1 },
      { type: OBSTACLE_TYPES.LOG, lanes: [2, 3, 4], difficulty: 1 },
      { type: OBSTACLE_TYPES.SNOWMAN, lanes: [0, 2, 4], difficulty: 1, gap: [1, 3] },
      { type: OBSTACLE_TYPES.TREE, lanes: [this.rng.nextInt(0, 4)], difficulty: 1 },
    ];

    const medium = [
      { type: OBSTACLE_TYPES.SNOWBALL, lanes: [this.rng.nextInt(0, 4)], difficulty: 2 },
      { type: OBSTACLE_TYPES.LOG, lanes: [1, 2, 3], difficulty: 2 },
      { type: OBSTACLE_TYPES.SNOWMAN, lanes: [0, 1, 3, 4], gap: [2], difficulty: 2 },
      { type: OBSTACLE_TYPES.THIN_ICE, lanes: [this.rng.nextInt(0, 4)], difficulty: 2 },
    ];

    const hard = [
      { type: OBSTACLE_TYPES.SNOWBALL, lanes: [0, 2, 4], difficulty: 3 },
      { type: OBSTACLE_TYPES.SNOWMAN, lanes: [0, 1, 2, 4], gap: [3], difficulty: 3 },
      { type: OBSTACLE_TYPES.LOG, lanes: [0, 1, 2, 3], gap: [4], difficulty: 3 },
      { type: OBSTACLE_TYPES.TREE, lanes: [1, 3], difficulty: 3 },
    ];

    let available = [...base];
    if (difficulty >= 2) available.push(...medium);
    if (difficulty >= 4) available.push(...hard);

    return available;
  }

  _buildPattern(pattern, playerSpeed, playerY) {
    const obstacles = [];
    const lanes = pattern.lanes || [this.rng.nextInt(0, 4)];
    const type = pattern.type;

    // For patterns with specific gaps, only spawn in non-gap lanes
    const gapLanes = new Set(pattern.gap || []);

    for (const lane of lanes) {
      if (gapLanes.has(lane)) continue;
      const x = this.lanePositions[lane];
      const obs = new Obstacle(type, lane, x, this.spawnY, playerSpeed * 0.85);
      obstacles.push(obs);
    }

    return obstacles;
  }

  _spawnPickup(playerSpeed) {
    const lane = this.rng.nextInt(0, 4);
    const x = this.lanePositions[lane];
    const type = this.rng.choice(ALL_PICKUPS);
    return new Pickup(type, lane, x, this.spawnY, playerSpeed * 0.85);
  }

  _spawnNPC(playerSpeed, playerY) {
    // Spawn NPCs slightly above the player (since world scrolls down)
    return new NPC(
      this.lanePositions[this.rng.nextInt(0, 4)],
      playerY - 80 - this.rng.nextInt(0, 120),
      playerSpeed,
      this.lanePositions
    );
  }
}
