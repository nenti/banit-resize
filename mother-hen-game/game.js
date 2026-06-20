// Mother Hen — a top-down "gather the chicks" game.
// Concept transcribed from a voice memo (see memo-transcript.txt):
// you play the mother hen, collect wandering chicks into a trailing line,
// lead them to the henhouse to sleep, dodge the eagle, grab magnets, and
// never eat the mushroom. Pure vanilla JS + canvas, no build step.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Logical play area is a fixed square; the canvas is scaled by CSS.
const W = canvas.width; // 640
const H = canvas.height; // 640
const FENCE = 24; // inset of the fence from the canvas edge
const INNER = { x: FENCE, y: FENCE, w: W - FENCE * 2, h: H - FENCE * 2 };

// ---- HUD elements ----
const elHearts = document.getElementById("hearts");
const elChicks = document.getElementById("chicks");
const elRound = document.getElementById("round");
const elMagnetPower = document.getElementById("magnet-power");
const elMagnetTime = document.getElementById("magnet-time");

const overlayStart = document.getElementById("overlay-start");
const overlayMessage = document.getElementById("overlay-message");
const msgTitle = document.getElementById("msg-title");
const msgBody = document.getElementById("msg-body");
const btnStart = document.getElementById("btn-start");
const btnNext = document.getElementById("btn-next");

// ---- Tunables ----
const HEN_SPEED = 215; // px/sec
const HEN_R = 20;
const CHICK_R = 12;
const CHICK_WANDER_SPEED = 55;
const CATCH_DIST = 30; // hen close enough to pick up a free chick
const TRAIL_SPACING = 26; // distance between chicks in the line
const EAGLE_SPEED = 150;
const EAGLE_R = 26;
const MAGNET_PULL = 320; // accel applied to free chicks while magnet active
const MAGNET_RANGE = 200;
const MAGNET_DURATION = 5; // seconds the magnet effect lasts
const INVULN_TIME = 1.6; // seconds of safety after a hit

const COOP = { x: INNER.x + 10, y: INNER.y + 10, w: 96, h: 84 };

// ---- Game state ----
let state = "start"; // start | playing | message
let round = 1;
let hearts = 3;
let invuln = 0;

let hen;
let trail; // array of caught chicks {x,y}
let henHistory; // recent hen positions for snake-style following
let freeChicks; // wandering chicks not yet caught
let delivered; // chicks safely tucked into the coop
let totalChicks;

let eagle;
let magnetItem = null; // pickup lying on the field
let magnetTimer = 0; // remaining magnet power
let mushroom = null;
let flowers = [];
let particles = [];

let spawnMagnetIn = 0;
let spawnMushroomIn = 0;
let snowy = false;

// ---- Input ----
const keys = new Set();
let pointer = null; // {x,y} target when dragging

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
    keys.add(k);
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

function canvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
  const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
  return { x: (cx / rect.width) * W, y: (cy / rect.height) * H };
}
function onPointerDown(e) {
  if (state !== "playing") return;
  pointer = canvasPoint(e);
  e.preventDefault();
}
function onPointerMove(e) {
  if (pointer) {
    pointer = canvasPoint(e);
    e.preventDefault();
  }
}
function onPointerUp() {
  pointer = null;
}
canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("mousemove", onPointerMove);
window.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });
canvas.addEventListener("touchmove", onPointerMove, { passive: false });
window.addEventListener("touchend", onPointerUp);

btnStart.addEventListener("click", () => {
  round = 1;
  hearts = 3;
  startRound();
});
btnNext.addEventListener("click", () => {
  overlayMessage.hidden = true;
  if (hearts <= 0) {
    round = 1;
    hearts = 3;
  }
  startRound();
});

// ---- Helpers ----
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function chickCountForRound(r) {
  // memo: "up to 14 chicks" round 1, then more — round 2 around 30.
  return [14, 30, 45][Math.min(r - 1, 2)] + Math.max(0, r - 3) * 15;
}

function randomFieldPos(margin = 40) {
  return {
    x: rand(INNER.x + margin, INNER.x + INNER.w - margin),
    y: rand(INNER.y + margin, INNER.y + INNER.h - margin),
  };
}

function awayFromCoop(p) {
  // keep chicks/items from spawning right on top of the henhouse
  return p.x > COOP.x + COOP.w + 30 || p.y > COOP.y + COOP.h + 30;
}

function spawnAwayFromCoop(margin = 40) {
  let p;
  do {
    p = randomFieldPos(margin);
  } while (!awayFromCoop(p));
  return p;
}

// ---- Round setup ----
function startRound() {
  state = "playing";
  overlayStart.hidden = true;
  overlayMessage.hidden = true;

  snowy = round >= 2; // memo: "sometimes the game is darker, with snow"
  totalChicks = chickCountForRound(round);
  delivered = 0;
  invuln = 0;
  magnetTimer = 0;
  magnetItem = null;
  mushroom = null;
  particles = [];
  pointer = null;

  hen = { x: COOP.x + COOP.w + 60, y: COOP.y + COOP.h + 60, dir: 1 };
  trail = [];
  henHistory = [];

  freeChicks = [];
  for (let i = 0; i < totalChicks; i++) {
    const p = spawnAwayFromCoop();
    const a = rand(0, Math.PI * 2);
    freeChicks.push({ x: p.x, y: p.y, vx: Math.cos(a) * CHICK_WANDER_SPEED, vy: Math.sin(a) * CHICK_WANDER_SPEED, wiggle: rand(0, 10) });
  }

  eagle = { x: INNER.x + INNER.w - 60, y: INNER.y + INNER.h / 2, dir: -1, vy: rand(-40, 40) };

  flowers = [];
  for (let i = 0; i < 10; i++) flowers.push(spawnAwayFromCoop(20));

  spawnMagnetIn = rand(3, 6);
  spawnMushroomIn = rand(6, 10);

  updateHud();
}

function updateHud() {
  elHearts.textContent = "❤️".repeat(hearts) + "🤍".repeat(Math.max(0, 3 - hearts));
  const caught = delivered + trail.length;
  elChicks.textContent = `🐥 ${caught} / ${totalChicks}`;
  elRound.textContent = `Round ${round}`;
  if (magnetTimer > 0) {
    elMagnetPower.hidden = false;
    elMagnetTime.textContent = magnetTimer.toFixed(1);
  } else {
    elMagnetPower.hidden = true;
  }
}

// ---- Effects ----
function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 150);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color });
  }
}

function loseHeart(reason, x, y) {
  if (invuln > 0) return;
  hearts--;
  invuln = INVULN_TIME;
  burst(x, y, "#ff5a5a", 16);
  // scared chicks scatter back into the field
  scatterTrail();
  updateHud();
  if (hearts <= 0) {
    endGame(false);
  }
}

function scatterTrail() {
  for (const c of trail) {
    const a = rand(0, Math.PI * 2);
    freeChicks.push({
      x: c.x,
      y: c.y,
      vx: Math.cos(a) * CHICK_WANDER_SPEED * 2.2,
      vy: Math.sin(a) * CHICK_WANDER_SPEED * 2.2,
      wiggle: rand(0, 10),
    });
  }
  trail = [];
}

// ---- Update ----
function update(dt) {
  if (state !== "playing") return;

  if (invuln > 0) invuln -= dt;

  // --- Hen movement ---
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  if (pointer && dx === 0 && dy === 0) {
    const ddx = pointer.x - hen.x;
    const ddy = pointer.y - hen.y;
    const d = Math.hypot(ddx, ddy);
    if (d > 6) {
      dx = ddx / d;
      dy = ddy / d;
    }
  } else if (dx !== 0 || dy !== 0) {
    const m = Math.hypot(dx, dy);
    dx /= m;
    dy /= m;
  }

  if (dx !== 0) hen.dir = dx > 0 ? 1 : -1;

  const prevX = hen.x;
  const prevY = hen.y;
  hen.x += dx * HEN_SPEED * dt;
  hen.y += dy * HEN_SPEED * dt;

  // fence collision — keep hen inside; a hard bump scatters the trail
  const minX = INNER.x + HEN_R;
  const maxX = INNER.x + INNER.w - HEN_R;
  const minY = INNER.y + HEN_R;
  const maxY = INNER.y + INNER.h - HEN_R;
  let bumped = false;
  if (hen.x < minX || hen.x > maxX) bumped = true;
  if (hen.y < minY || hen.y > maxY) bumped = true;
  hen.x = clamp(hen.x, minX, maxX);
  hen.y = clamp(hen.y, minY, maxY);
  if (bumped && trail.length > 0 && (Math.abs(hen.x - prevX) > 1 || Math.abs(hen.y - prevY) > 1)) {
    // running into the fence with chicks in tow loses one (gentle nudge)
    const lost = trail.pop();
    const a = rand(0, Math.PI * 2);
    freeChicks.push({ x: lost.x, y: lost.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, wiggle: rand(0, 10) });
    burst(hen.x, hen.y, "#fff0a0", 6);
    updateHud();
  }

  // record hen path for snake-style trailing
  henHistory.unshift({ x: hen.x, y: hen.y });
  const maxHistory = Math.ceil(((trail.length + 1) * TRAIL_SPACING) / Math.max(40, HEN_SPEED * dt)) + 60;
  if (henHistory.length > maxHistory) henHistory.length = maxHistory;

  // --- Free chicks wander, and react to magnet ---
  const magnetOn = magnetTimer > 0;
  for (const c of freeChicks) {
    if (magnetOn && dist(c, hen) < MAGNET_RANGE) {
      const ddx = hen.x - c.x;
      const ddy = hen.y - c.y;
      const d = Math.hypot(ddx, ddy) || 1;
      c.vx += (ddx / d) * MAGNET_PULL * dt;
      c.vy += (ddy / d) * MAGNET_PULL * dt;
    } else {
      // gentle random wander
      c.wiggle += dt;
      if (c.wiggle > rand(1.2, 2.2)) {
        const a = rand(0, Math.PI * 2);
        c.vx = Math.cos(a) * CHICK_WANDER_SPEED;
        c.vy = Math.sin(a) * CHICK_WANDER_SPEED;
        c.wiggle = 0;
      }
    }
    // cap speed
    const sp = Math.hypot(c.vx, c.vy);
    const cap = magnetOn ? 260 : CHICK_WANDER_SPEED * 1.4;
    if (sp > cap) {
      c.vx = (c.vx / sp) * cap;
      c.vy = (c.vy / sp) * cap;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    // bounce off fence
    if (c.x < INNER.x + CHICK_R) { c.x = INNER.x + CHICK_R; c.vx = Math.abs(c.vx); }
    if (c.x > INNER.x + INNER.w - CHICK_R) { c.x = INNER.x + INNER.w - CHICK_R; c.vx = -Math.abs(c.vx); }
    if (c.y < INNER.y + CHICK_R) { c.y = INNER.y + CHICK_R; c.vy = Math.abs(c.vy); }
    if (c.y > INNER.y + INNER.h - CHICK_R) { c.y = INNER.y + INNER.h - CHICK_R; c.vy = -Math.abs(c.vy); }
  }

  // --- Catch chicks ---
  for (let i = freeChicks.length - 1; i >= 0; i--) {
    if (dist(freeChicks[i], hen) < CATCH_DIST + HEN_R) {
      trail.push({ x: freeChicks[i].x, y: freeChicks[i].y });
      freeChicks.splice(i, 1);
      burst(hen.x, hen.y, "#fff7c0", 6);
      updateHud();
    }
  }

  // --- Trail follows the hen's path at fixed spacing ---
  for (let i = 0; i < trail.length; i++) {
    const targetDist = (i + 1) * TRAIL_SPACING;
    const idx = Math.min(henHistory.length - 1, Math.round(targetDist / Math.max(6, HEN_SPEED * dt)));
    const target = henHistory[idx] || henHistory[henHistory.length - 1] || hen;
    // ease toward the target slot
    trail[i].x += (target.x - trail[i].x) * Math.min(1, dt * 14);
    trail[i].y += (target.y - trail[i].y) * Math.min(1, dt * 14);
  }

  // --- Deliver chicks to coop ---
  const inCoop =
    hen.x > COOP.x - HEN_R &&
    hen.x < COOP.x + COOP.w + HEN_R &&
    hen.y > COOP.y - HEN_R &&
    hen.y < COOP.y + COOP.h + HEN_R;
  if (inCoop && trail.length > 0) {
    delivered += trail.length;
    burst(COOP.x + COOP.w / 2, COOP.y + COOP.h / 2, "#ffe08a", 14);
    trail = [];
    updateHud();
  }

  // --- Eagle patrol (moves back and forth, drifts vertically) ---
  eagle.x += eagle.dir * EAGLE_SPEED * dt;
  eagle.y += eagle.vy * dt;
  if (eagle.x < INNER.x + EAGLE_R) { eagle.x = INNER.x + EAGLE_R; eagle.dir = 1; }
  if (eagle.x > INNER.x + INNER.w - EAGLE_R) { eagle.x = INNER.x + INNER.w - EAGLE_R; eagle.dir = -1; }
  if (eagle.y < INNER.y + EAGLE_R || eagle.y > INNER.y + INNER.h - EAGLE_R) eagle.vy *= -1;
  eagle.y = clamp(eagle.y, INNER.y + EAGLE_R, INNER.y + INNER.h - EAGLE_R);
  if (Math.random() < 0.01) eagle.vy = rand(-60, 60);

  // eagle hits the hen or a trailing chick
  if (dist(eagle, hen) < EAGLE_R + HEN_R) {
    loseHeart("eagle", hen.x, hen.y);
  } else {
    for (const c of trail) {
      if (dist(eagle, c) < EAGLE_R + CHICK_R) {
        loseHeart("eagle", c.x, c.y);
        break;
      }
    }
  }

  // --- Magnet pickup lifecycle ---
  if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
  if (magnetItem) {
    magnetItem.ttl -= dt;
    if (magnetItem.ttl <= 0) {
      magnetItem = null;
      spawnMagnetIn = rand(4, 8);
    } else if (dist(magnetItem, hen) < HEN_R + 18) {
      magnetTimer = MAGNET_DURATION;
      burst(magnetItem.x, magnetItem.y, "#6fb7ff", 12);
      magnetItem = null;
      spawnMagnetIn = rand(5, 9);
    }
  } else {
    spawnMagnetIn -= dt;
    if (spawnMagnetIn <= 0) {
      const p = spawnAwayFromCoop();
      magnetItem = { x: p.x, y: p.y, ttl: rand(4.5, 6.5) }; // vanishes quickly!
    }
  }
  if (magnetTimer > 0) updateHud();

  // --- Mushroom lifecycle (trap) ---
  if (mushroom) {
    mushroom.ttl -= dt;
    if (mushroom.ttl <= 0) {
      mushroom = null;
      spawnMushroomIn = rand(6, 11);
    } else if (dist(mushroom, hen) < HEN_R + 16) {
      // ate the mushroom — bad!
      const mx = mushroom.x;
      const my = mushroom.y;
      mushroom = null;
      spawnMushroomIn = rand(7, 12);
      loseHeart("mushroom", mx, my);
    }
  } else {
    spawnMushroomIn -= dt;
    if (spawnMushroomIn <= 0) {
      mushroom = { ...spawnAwayFromCoop(), ttl: rand(7, 11) };
    }
  }

  // --- Particles ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // --- Win check ---
  if (delivered >= totalChicks) {
    endGame(true);
  }
}

function endGame(won) {
  state = "message";
  if (won) {
    msgTitle.textContent = "🌙 All tucked in!";
    msgBody.textContent = `You led all ${totalChicks} chicks safely to bed. Ready for a bigger flock in round ${round + 1}?`;
    btnNext.textContent = "Next round";
    round++;
  } else {
    msgTitle.textContent = "💔 Oh no!";
    msgBody.textContent = `The flock got away. You tucked in ${delivered} of ${totalChicks} chicks. Try again?`;
    btnNext.textContent = "Try again";
  }
  overlayMessage.hidden = false;
}

// ---- Render ----
function drawField() {
  // grass / snow base
  ctx.fillStyle = snowy ? "#dfeefc" : "#7cc36b";
  ctx.fillRect(0, 0, W, H);

  // subtle checker for texture
  ctx.fillStyle = snowy ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.05)";
  const tile = 40;
  for (let y = 0; y < H; y += tile) {
    for (let x = 0; x < W; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
    }
  }

  // fence frame
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#b3792f";
  ctx.strokeRect(FENCE, FENCE, INNER.w, INNER.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.strokeRect(FENCE, FENCE, INNER.w, INNER.h);
  // fence posts
  ctx.fillStyle = "#9c6526";
  const posts = 10;
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    drawPost(FENCE + t * INNER.w, FENCE);
    drawPost(FENCE + t * INNER.w, FENCE + INNER.h);
    drawPost(FENCE, FENCE + t * INNER.h);
    drawPost(FENCE + INNER.w, FENCE + t * INNER.h);
  }
}
function drawPost(x, y) {
  ctx.fillRect(x - 4, y - 8, 8, 16);
}

function drawCoop() {
  ctx.save();
  // body
  ctx.fillStyle = "#c98a4b";
  roundRect(COOP.x, COOP.y + 24, COOP.w, COOP.h - 24, 8);
  ctx.fill();
  // roof
  ctx.fillStyle = "#8a4f2b";
  ctx.beginPath();
  ctx.moveTo(COOP.x - 6, COOP.y + 28);
  ctx.lineTo(COOP.x + COOP.w / 2, COOP.y - 2);
  ctx.lineTo(COOP.x + COOP.w + 6, COOP.y + 28);
  ctx.closePath();
  ctx.fill();
  // door
  ctx.fillStyle = "#5a3318";
  roundRect(COOP.x + COOP.w / 2 - 16, COOP.y + COOP.h - 38, 32, 38, 6);
  ctx.fill();
  ctx.restore();
  emoji("🏠", COOP.x + COOP.w / 2, COOP.y + 14, 22);
  emoji("💤", COOP.x + COOP.w - 12, COOP.y + 6, 16);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function emoji(ch, x, y, size) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y);
}

function render() {
  drawField();

  // flowers (decoration)
  for (const f of flowers) emoji(snowy ? "❄️" : "🌸", f.x, f.y, 22);

  drawCoop();

  // magnet pickup (blinks as it's about to vanish)
  if (magnetItem) {
    if (magnetItem.ttl > 1.5 || Math.floor(magnetItem.ttl * 6) % 2 === 0) {
      emoji("🧲", magnetItem.x, magnetItem.y, 30);
    }
  }
  // mushroom trap
  if (mushroom) {
    if (mushroom.ttl > 1.5 || Math.floor(mushroom.ttl * 6) % 2 === 0) {
      emoji("🍄", mushroom.x, mushroom.y, 28);
    }
  }

  // free chicks
  for (const c of freeChicks) emoji("🐥", c.x, c.y, CHICK_R * 2);

  // trailing chicks
  for (const c of trail) emoji("🐤", c.x, c.y, CHICK_R * 2);

  // hen (flash when invulnerable)
  if (hen) {
    const flash = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flash ? 0.4 : 1;
    ctx.save();
    ctx.translate(hen.x, hen.y);
    if (hen.dir < 0) ctx.scale(-1, 1);
    emoji("🐔", 0, 0, HEN_R * 2.2);
    ctx.restore();
    ctx.restore();

    // magnet aura
    if (magnetTimer > 0) {
      ctx.beginPath();
      ctx.arc(hen.x, hen.y, MAGNET_RANGE, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(80,160,255,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // eagle
  if (eagle) {
    ctx.save();
    ctx.translate(eagle.x, eagle.y);
    if (eagle.dir < 0) ctx.scale(-1, 1);
    emoji("🦅", 0, 0, EAGLE_R * 2);
    ctx.restore();
  }

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- Main loop ----
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big gaps (tab switches)
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
