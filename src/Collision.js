// ============================================================
// Collision.js - Collision detection and response
// ============================================================

export class CollisionSystem {
  constructor() {}

  /**
   * Check all obstacle collisions against player
   * Returns array of hit results
   */
  checkObstacles(player, obstacles, audio) {
    if (player.invulTimer > 0 || player.dead) return [];

    const playerHB = player.getHitbox();
    const hits = [];

    for (const obs of obstacles) {
      if (!obs.active) continue;

      // Main obstacle collision
      const result = obs.checkCollision(playerHB, player.jumping);
      if (result) {
        if (result.stun) {
          // Check if player has axe and obstacle is chopable
          if (result.chopable && player.hasAxe) {
            player.useAxe();
            obs.active = false;
            if (audio) audio.playAxeChop();
            hits.push({ type: 'chop', obs });
          } else {
            player.stun(result.stunDur || 1000, audio);
            hits.push({ type: 'stun', obs });
          }
        } else if (result.slowSteering) {
          hits.push({ type: 'ice', obs });
        } else if (result.slowSpeed) {
          player.speed = Math.max(player.speed * 0.7, player.baseSpeed * 0.5);
        }
      }

      // Projectile collisions
      const projResult = obs.checkProjectileCollisions(playerHB);
      if (projResult && projResult.stun && player.invulTimer <= 0) {
        player.stun(projResult.stunDur, audio);
        hits.push({ type: 'projectile', obs });
      }
    }

    return hits;
  }

  /**
   * Check pickup collisions
   * Returns array of collected pickups
   */
  checkPickups(player, pickups, audio) {
    const playerHB = player.getHitbox();
    const collected = [];

    for (const pickup of pickups) {
      if (!pickup.active || pickup.collected) continue;
      if (pickup.checkCollect(playerHB)) {
        pickup.collect();
        collected.push(pickup);
        if (audio) audio.playPickup();
      }
    }

    return collected;
  }

  /**
   * Check if owl swoop hits player
   */
  checkOwlCapture(player, owl) {
    if (player.invulTimer > 0 || player.dead) return false;

    const playerHB = player.getHitbox();
    return owl.checkSwoopCapture(playerHB);
  }
}
