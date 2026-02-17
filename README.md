[README.md](https://github.com/user-attachments/files/25374214/README.md)
# 🦉 Snow Owl Chase

A fast-paced browser runner game where a giant snow owl hunts you through a snowy wilderness. Sprint toward the finish line, dodge obstacles, avoid swoop attacks, and outlast the hunt.

---

## 🎮 How to Run

```bash
# Option 1: Python server (recommended)
cd snow-owl-chase
python3 -m http.server 8080

# Then open: http://localhost:8080

# Option 2: Any static file server
npx serve .
# or: npx http-server .
```

> **Note:** Must be served (not opened as `file://`) due to ES module imports.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `A` / `←` | Move one lane left |
| `D` / `→` | Move one lane right |
| `Space` | Jump over logs, branches, snowballs |
| `Shift` | Dash (speed burst, reduces owl threat) |
| `1` / `F` | Use Feather Axe (chop a tree obstacle) |
| `Esc` | Pause |

---

## 🌨️ Gameplay Overview

### The Chase
The snow owl lurks behind you, always closing in. Your **threat meter** fills when you:
- Get stunned by obstacles
- Stand in owl shadow zones
- Play slowly

Keep the threat low with clean running, dashing, and picking up **Wind Gusts**.

### Swoop Attacks
When the owl swoops, a **dark shadow** appears on the ground. Move out of the shadow before the timer expires, or you're caught. Later levels have false shadows (purple-tinted) to fake you out.

### Levels & Roguelite Progression
- Each level has a finish line at increasing distances
- After completing a level, choose **one of three upgrades**
- Upgrades persist for your current run
- Game over = start over (upgrades reset)

---

## 🚧 Obstacle Types

| Obstacle | Strategy |
|----------|----------|
| **Fallen Log** | Jump over |
| **Evil Snowman** | Dodge to another lane (red glow = dangerous; blue = harmless decoy!) |
| **Pine Tree** | Dodge, or use Feather Axe to chop it |
| **Rolling Snowball** | Jump over |
| **Ice Patch** | Reduces steering control temporarily |
| **Thin Ice** | Cracks on contact, slows you briefly |
| **Snowdrift** | Slows you; can jump over |
| **Branch Whip** | Jump over (low-hanging hazard) |

---

## ✨ Pickups

| Pickup | Effect |
|--------|--------|
| 🪓 **Feather Axe** | Chop one tree on collision instead of stunting |
| 💨 **Wind Gust** | Brief speed boost, reduces owl threat |
| ☕ **Hot Cocoa** | Reduces stun duration once |
| 🏮 **Lantern Charm** | Shortens the next owl shadow warning |
| 🔔 **Lucky Bell** | Temporarily reduces obstacle density |

---

## 👤 Characters

| Character | Perk | Tradeoff |
|-----------|------|----------|
| **The Sprinter** | +12% speed, faster dash recharge | +20% stun time, -8% jump hang |
| **The Jumper** | +25% jump height, +15% hang time | +20% dash cooldown, -8% speed |
| **The Survivor** | -30% stun duration, +40% invul frames | -10% acceleration recovery |
| **The Scout** | +30% shadow warning time, +20% pickups | -10% score multiplier, -15% dash distance |

Toggle **Attribute Mode** in Settings or Character Select to play with equal stats.

---

## 🏆 Upgrades (Between Levels)

- 🦘 **Spring Legs** — +20% jump hang time
- ⚡ **Quick Feet** — -25% stun duration  
- 💨 **Tailwind** — -20% dash cooldown
- 🎯 **Nimble Frame** — Smaller hitbox
- 👁️ **Sharp Eyes** — +30% more pickups

---

## 🌟 Special Events

- **Aurora Borealis** — Beautiful sky segment with bonus score
- **Blizzard** — Reduced visibility, shorter shadow warnings, but more pickups

---

## 🏅 Achievements (Local)

- **No Stun Run** — Complete a level without getting stunned
- **Shadow Dancer** — Dodge 10 swoop attacks
- **Lumberjack** — Chop 20 trees with the Feather Axe

---

## 💡 Tips

1. **Stay moving** — The owl closes in whenever you slow down or get stunned
2. **Watch for shadows** — A dark oval = get out NOW. Purple = fake.
3. **Dash strategically** — Dash doesn't just speed you up, it pushes the owl back
4. **Evil vs benign snowmen** — Red glowing snowmen hurt you; soft blue ones are harmless
5. **NPCs attract the owl** — The owl sometimes snatches runner NPCs instead of you!
6. **Daily Seed mode** — Enable in Settings for a repeatable daily run

---

## 📁 Project Structure

```
snow-owl-chase/
├── index.html              # Entry point
├── README.md
├── assets/                 # (empty - all art is procedural canvas)
└── src/
    ├── main.js             # Game loop and canvas setup
    ├── game.js             # Core game state, rendering, UI screens
    ├── input.js            # Input handler with buffering
    ├── utils.js            # Utilities, seeded RNG, localStorage helpers
    ├── entities/
    │   ├── Player.js       # Player with character stats
    │   ├── Owl.js          # Owl threat system and swoop attacks
    │   ├── Obstacle.js     # 8 obstacle types
    │   ├── NPC.js          # Runner NPCs (snatchable)
    │   └── Pickup.js       # 5 pickup types
    ├── systems/
    │   ├── Spawner.js      # Procedural obstacle/pickup/NPC spawning
    │   ├── Collision.js    # AABB collision detection
    │   └── Audio.js        # WebAudio oscillator sound system
    └── ui/
        └── HUD.js          # Heads-up display rendering
```

---

## 🤝 Contributing

1. Fork the repo
2. Make your changes
3. Test in browser via `python3 -m http.server`
4. Open a PR with a description of what you changed

Ideas welcome: new obstacle types, character designs, level themes, accessibility features.

---

## 📄 License

MIT
