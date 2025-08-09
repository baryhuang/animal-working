import Phaser from 'phaser';

type Controls = {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd: Record<'W'|'A'|'S'|'D', Phaser.Input.Keyboard.Key>;
  dash: Phaser.Input.Keyboard.Key;
};

const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1600;

function createHeroTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  g.fillStyle(0x2ce6ff, 1);
  g.fillCircle(16, 18, 12); // body
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 10, 7); // head
  g.fillStyle(0x0a0b0f, 0.25);
  g.fillEllipse(16, 30, 22, 10); // fake shadow baked
  const key = 'hero';
  g.generateTexture(key, 32, 36);
  g.destroy();
  return key;
}

function createTreeTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  g.fillStyle(0x2f8f2f, 1);
  g.fillCircle(26, 24, 22);
  g.fillStyle(0x246f24, 1);
  g.fillCircle(18, 18, 16);
  g.fillStyle(0x6e4b1f, 1);
  g.fillRect(22, 36, 8, 14);
  const key = 'tree';
  g.generateTexture(key, 52, 56);
  g.destroy();
  return key;
}

function createRockTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  g.fillStyle(0x7b7f86, 1);
  g.fillRoundedRect(2, 8, 28, 18, 8);
  g.lineStyle(2, 0x5a5d63, 1);
  g.strokeRoundedRect(2, 8, 28, 18, 8);
  const key = 'rock';
  g.generateTexture(key, 32, 32);
  g.destroy();
  return key;
}

function createSparkTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  const key = 'spark';
  g.generateTexture(key, 8, 8);
  g.destroy();
  return key;
}

function addFancyBackground(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const bg = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setScrollFactor(0);
  const grad = scene.add.graphics();
  // Starry gradient sky
  const top = 0x0b0d13;
  const bottom = 0x151a24;
  for (let y = 0; y < height; y += 2) {
    const t = y / height;
    const r = ((top >> 16) & 0xff) * (1 - t) + ((bottom >> 16) & 0xff) * t;
    const g = ((top >> 8) & 0xff) * (1 - t) + ((bottom >> 8) & 0xff) * t;
    const b = (top & 0xff) * (1 - t) + (bottom & 0xff) * t;
    grad.fillStyle(((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff), 1);
    grad.fillRect(0, y, width, 2);
  }
  bg.draw(grad, 0, 0);
  grad.destroy();

  // Vignette
  const vignette = scene.add.graphics();
  const radius = Math.max(width, height);
  for (let i = 0; i < 80; i++) {
    const alpha = i / 120;
    vignette.lineStyle(6, 0x000000, alpha * 0.08);
    vignette.strokeCircle(width / 2, height / 2, radius - i * 10);
  }
  bg.draw(vignette, 0, 0);
  vignette.destroy();
}

function spawnScenery(scene: Phaser.Scene, treeKey: string, rockKey: string): Phaser.Physics.Arcade.StaticGroup {
  const group = scene.physics.add.staticGroup();
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  for (let i = 0; i < 80; i++) {
    const useTree = Math.random() > 0.35;
    const x = rand(200, WORLD_WIDTH - 200);
    const y = rand(200, WORLD_HEIGHT - 200);
    const spr = group.create(x, y, useTree ? treeKey : rockKey) as Phaser.Physics.Arcade.Sprite;
    spr.setScale(Phaser.Math.FloatBetween(0.7, 1.2));
    spr.setDepth(y);
    spr.refreshBody();
  }
  return group;
}

function setupControls(scene: Phaser.Scene): Controls {
  const cursors = scene.input.keyboard!.createCursorKeys();
  const keys = scene.input.keyboard!.addKeys('W,A,S,D,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
  return {
    cursors,
    wasd: { W: keys.W, A: keys.A, S: keys.S, D: keys.D },
    dash: keys.SPACE
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createGameScene(): Phaser.Scene {
  let player!: Phaser.Physics.Arcade.Sprite;
  let controls!: Controls;
  let emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  let scenery!: Phaser.Physics.Arcade.StaticGroup;

  const scene = new Phaser.Scene('Game');

  scene.preload = () => {
    createHeroTexture(scene);
    createTreeTexture(scene);
    createRockTexture(scene);
    createSparkTexture(scene);
  };

  scene.create = () => {
    scene.cameras.main.setZoom(1.15);
    scene.cameras.main.setBackgroundColor('#0e1014');
    scene.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    addFancyBackground(scene);

    // Ground fake perspective grid lines
    const grid = scene.add.graphics();
    grid.lineStyle(1, 0x1d2430, 0.8);
    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      grid.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 80) {
      grid.lineBetween(0, y, WORLD_WIDTH, y);
    }
    grid.setAlpha(0.25);

    // Physics world
    scene.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Scenery
    scenery = spawnScenery(scene, 'tree', 'rock');

    // Player
    player = scene.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'hero');
    player.setCircle(12, 4, 6);
    player.setCollideWorldBounds(true);
    player.setDepth(player.y);

    // Particles (Phaser 3.60+ API: add.particles returns an Emitter)
    emitter = scene.add.particles(player.x, player.y, 'spark', {
      quantity: 0,
      speed: { min: 10, max: 60 },
      scale: { start: 0.7, end: 0 },
      lifespan: 450,
      alpha: { start: 0.5, end: 0 },
      blendMode: 'ADD',
    });

    // Collisions
    scene.physics.add.collider(player, scenery);

    // Controls
    controls = setupControls(scene);

    // Camera follow with slight offset for cinematic look
    scene.cameras.main.startFollow(player, true, 0.1, 0.1);

    // Dash hint pulse removed for compatibility; we modulate quantity in update
  };

  scene.update = (_time, delta) => {
    if (!player) return;
    const body = player.body as Phaser.Physics.Arcade.Body;

    const speed = 220;
    const dashSpeed = 480;
    const accel = 1400;
    const deaccel = 1600;

    let targetVx = 0;
    let targetVy = 0;
    const up = controls.cursors.up.isDown || controls.wasd.W.isDown;
    const down = controls.cursors.down.isDown || controls.wasd.S.isDown;
    const left = controls.cursors.left.isDown || controls.wasd.A.isDown;
    const right = controls.cursors.right.isDown || controls.wasd.D.isDown;
    const isDashing = controls.dash.isDown;

    const base = isDashing ? dashSpeed : speed;
    if (up) targetVy -= base;
    if (down) targetVy += base;
    if (left) targetVx -= base;
    if (right) targetVx += base;

    // Normalize diagonal
    if (targetVx !== 0 && targetVy !== 0) {
      const inv = 1 / Math.sqrt(2);
      targetVx *= inv;
      targetVy *= inv;
    }

    // Smooth approach velocities
    const dt = delta / 1000;
    const nextVx = Phaser.Math.Linear(body.velocity.x, targetVx, clamp((targetVx === 0 ? deaccel : accel) * dt / base, 0, 1));
    const nextVy = Phaser.Math.Linear(body.velocity.y, targetVy, clamp((targetVy === 0 ? deaccel : accel) * dt / base, 0, 1));
    body.setVelocity(nextVx, nextVy);

    // Fancy trails only when moving
    const moving = Math.abs(nextVx) + Math.abs(nextVy) > 10;
    if (emitter) {
      emitter.setQuantity(moving ? (isDashing ? 6 : 2) : 0);
      emitter.setPosition(player.x, player.y);
    }

    // Pseudo 3D: scale with Y (closer = larger), depth-sort by Y
    const yRatio = player.y / WORLD_HEIGHT;
    const scale = 0.6 + 0.9 * yRatio;
    player.setScale(scale);
    player.setDepth(player.y);

    // Camera slight tilt by velocity
    const cam = scene.cameras.main;
    cam.setLerp(0.12, 0.12);
    cam.setZoom(1.1 + 0.04 * (isDashing ? 1 : 0));
    cam.rotation = Phaser.Math.Angle.RotateTo(cam.rotation, Phaser.Math.Angle.Wrap(Math.atan2(nextVx, -nextVy) * 0.03), 0.0008 * delta);
  };

  // Expose a clean API
  return scene;
}


