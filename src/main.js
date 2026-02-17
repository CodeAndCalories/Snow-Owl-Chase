// ============================================================
// main.js - Entry point, canvas setup, and game loop
// ============================================================

import { InputHandler } from './input.js';
import { AudioSystem } from './systems/Audio.js';
import { Game } from './game.js';

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive sizing
function resize() {
  const maxW = 800;
  const maxH = 640;
  const scaleW = Math.min(1, window.innerWidth / maxW);
  const scaleH = Math.min(1, window.innerHeight / maxH);
  const scale = Math.min(scaleW, scaleH);

  canvas.width = maxW;
  canvas.height = maxH;
  canvas.style.width = `${maxW * scale}px`;
  canvas.style.height = `${maxH * scale}px`;
}

resize();
window.addEventListener('resize', resize);

// Systems
const input = new InputHandler();
const audio = new AudioSystem();
audio.init();

// Game
const game = new Game(canvas, input, audio);
function updateCursor() {
  const menuStates = new Set([
    'title',
    'charselect',
    'howtoplay',
    'settings',
    'gameover',
    'upgrade',
    'paused'
  ]);

  canvas.style.cursor = menuStates.has(game.state)
    ? 'default'
    : 'none';
}

// Interaction to resume audio context
document.addEventListener('click', (e) => {
  audio.resume();
  handleCanvasClick(e);
}, { once: false });

document.addEventListener('keydown', () => audio.resume(), { once: true });

// Canvas click handling for title screen buttons
function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  const cw = canvas.width;
  const ch = canvas.height;

  if (game.state === 'title') {
    // Check button clicks
    const items = [
      { action: () => game.startLevel(game.level) },
      { action: () => { game.state = 'charselect'; } },
      { action: () => { game.state = 'howtoplay'; } },
      { action: () => { game.state = 'settings'; } },
    ];
    items.forEach((item, i) => {
      const by = 354 + i * 52;
      if (mx >= cw / 2 - 150 && mx <= cw / 2 + 150 && my >= by && my <= by + 40) {
        item.action();
      }
    });
  } else if (game.state === 'charselect') {
    const cardW = 140;
    const cardH = 240;
    const gap = 16;
    const totalW = 4 * cardW + 3 * gap;
    const startX = (cw - totalW) / 2;

    for (let i = 0; i < 4; i++) {
      const cx = startX + i * (cardW + gap);
      if (mx >= cx && mx <= cx + cardW && my >= 70 && my <= 70 + cardH + 10) {
        game.charSelectIdx = i;
      }
    }

    // Confirm button
    if (mx >= cw / 2 - 100 && mx <= cw / 2 + 100 && my >= ch - 63 && my <= ch - 11) {
      game.selectedCharIdx = game.charSelectIdx;
      localStorage.setItem('snow_owl_selectedChar', JSON.stringify(game.charSelectIdx));
      game.state = 'title';
    }

    // Attr toggle
    if (mx >= cw / 2 - 160 && mx <= cw / 2 + 160 && my >= ch - 105 && my <= ch - 75) {
      game.attributesMode = !game.attributesMode;
      localStorage.setItem('snow_owl_attributesMode', JSON.stringify(game.attributesMode));
    }
  } else if (game.state === 'gameover') {
    // Retry
    if (mx >= cw / 2 - 110 && mx <= cw / 2 - 10 && my >= ch - 98 && my <= ch - 46) {
      game.upgrades = [];
      localStorage.setItem('snow_owl_upgrades', JSON.stringify([]));
      game.level = 1;
      game.startLevel(1);
    }
    // Menu
    if (mx >= cw / 2 + 10 && mx <= cw / 2 + 110 && my >= ch - 98 && my <= ch - 46) {
      game.state = 'title';
    }
  } else if (game.state === 'upgrade') {
    const cardW = 200;
    const gap = 20;
    const totalW = game.upgradeOptions.length * cardW + (game.upgradeOptions.length - 1) * gap;
    const startX = (cw - totalW) / 2;
    const cy = ch / 2;

    game.upgradeOptions.forEach((_, i) => {
      const cx = startX + i * (cardW + gap);
      if (mx >= cx && mx <= cx + cardW && my >= cy - 75 && my <= cy + 75) {
        game.selectedUpgradeIdx = i;
        // Double click = confirm
      }
    });
  }
}

// Game loop
let lastTime = 0;
let frameId;

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

   updateCursor();   // ADD THIS LINE
  
  // Handle non-playing state input
  if (game.state !== 'playing' && game.state !== 'paused') {
    game.handleUIInput();
  }

  game.update(dt);
  game.draw();

  input.update();
  frameId = requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastTime = t;
  loop(t);
});

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Game error:', e.error);
});

console.log('%cSnow Owl Chase loaded! 🦉', 'color: #74b9ff; font-size: 16px; font-weight: bold;');
