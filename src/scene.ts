import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { sfx } from './audio';

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

function createShadowTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 1);
  g.fillEllipse(30, 14, 60, 28);
  const key = 'shadow';
  g.generateTexture(key, 60, 28);
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

function createGroundTexture(scene: Phaser.Scene): string {
  const g = scene.add.graphics();
  const c1 = 0x2a2f35; // warm-dark
  const c2 = 0x22282e; // warm-darker
  // 64x64 pattern of 4 squares (32x32 each) for a checkered tile floor
  g.fillStyle(c1, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  g.fillStyle(c2, 1);
  g.fillRect(32, 0, 32, 32);
  g.fillRect(0, 32, 32, 32);

  // subtle cross highlight
  g.lineStyle(1, 0x40464d, 0.15);
  g.strokeLineShape(new Phaser.Geom.Line(0, 32, 64, 32));
  g.strokeLineShape(new Phaser.Geom.Line(32, 0, 32, 64));

  const key = 'ground64';
  g.generateTexture(key, 64, 64);
  g.destroy();
  return key;
}

function spawnScenery(scene: Phaser.Scene, treeKey: string, rockKey: string): Phaser.Physics.Arcade.StaticGroup {
  const group = scene.physics.add.staticGroup();
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  for (let i = 0; i < 80; i++) {
    const useTree = Math.random() > 0.35;
    const x = rand(200, WORLD_WIDTH - 200);
    const y = rand(200, WORLD_HEIGHT - 200);
    const spr = group.create(x, y, useTree ? treeKey : rockKey) as Phaser.Physics.Arcade.Sprite;
    const yRatio = y / WORLD_HEIGHT;
    const perspectiveScale = 0.5 + 1.6 * yRatio; // far small, near big
    const baseRand = Phaser.Math.FloatBetween(0.75, 1.25);
    spr.setScale(baseRand * perspectiveScale);
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

type SceneConfig = {
  name?: string;
  banner?: string;
  exits?: { x: number; y: number; label: string; target: string }[];
  npcs?: { x: number; y: number; text: string[] }[];
  spawn?: { x: number; y: number };
};

export function createGameScene(config: SceneConfig = {}): Phaser.Scene {
  let player!: Phaser.Physics.Arcade.Sprite;
  let controls!: Controls;
  let emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  let scenery!: Phaser.Physics.Arcade.StaticGroup;
  let shadow!: Phaser.GameObjects.Image;
  let ui!: DialogHandle;
  let enterKey!: Phaser.Input.Keyboard.Key;
  let labels: Phaser.GameObjects.Text[] = [];

  const scene = new Phaser.Scene(config.name ?? 'Game');

  scene.preload = () => {
    createHeroTexture(scene);
    createTreeTexture(scene);
    createRockTexture(scene);
    createSparkTexture(scene);
    createShadowTexture(scene);
    createGroundTexture(scene);
  };

  scene.create = () => {
    ui = createUI();
    enterKey = scene.input.keyboard!.addKey('E');
    scene.cameras.main.setZoom(1.15);
    scene.cameras.main.setBackgroundColor('#0e1014');
    scene.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    addFancyBackground(scene);

    // Warm retro checker floor
    const ground = scene.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'ground64')
      .setOrigin(0, 0)
      .setDepth(-1000);

    // Ground fake perspective grid lines
    const grid = scene.add.graphics();
    grid.lineStyle(1, 0x1d2430, 0.8);
    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      grid.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 80) {
      grid.lineBetween(0, y, WORLD_WIDTH, y);
    }
    grid.setAlpha(0.12);

    // Physics world
    scene.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Scenery
    scenery = spawnScenery(scene, 'tree', 'rock');

    // Player (create BEFORE sensors so overlaps bind correctly)
    const spawnX = config.spawn?.x ?? WORLD_WIDTH / 2;
    const spawnY = config.spawn?.y ?? WORLD_HEIGHT / 2;
    player = scene.physics.add.sprite(spawnX, spawnY, 'hero');
    player.setCircle(12, 4, 6);
    player.setCollideWorldBounds(true);
    player.setDepth(player.y);

    // Soft blob shadow under hero for height/depth illusion
    shadow = scene.add.image(player.x, player.y + 14, 'shadow')
      .setAlpha(0.22)
      .setDepth(player.y - 1)
      .setScale(0.6);

    // Exit labels and sensor zones
    labels.forEach(l => l.destroy());
    labels = [];
    (config.exits ?? []).forEach(exit => {
      const text = scene.add.text(exit.x, exit.y - 28, exit.label, {
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        color: '#ffd48a',
        stroke: '#6b3c00',
        strokeThickness: 3
      }).setDepth(exit.y + 100);
      labels.push(text);

      const sensor = scene.add.zone(exit.x, exit.y, 90, 90);
      scene.physics.add.existing(sensor, true);
      scene.physics.add.overlap(player, sensor, () => {
        ui.setPrompt(`按 E 进入 · ${exit.label}`);
        if (enterKey.isDown) {
          sfx('ok');
          scene.scene.start(exit.target);
        }
      });
    });

    // NPCs
    (config.npcs ?? []).forEach(n => {
      const npc = scene.add.sprite(n.x, n.y, 'tree').setDepth(n.y).setScale(0.8);
      const zone = scene.add.zone(n.x, n.y, 80, 80);
      scene.physics.add.existing(zone, true);
      scene.physics.add.overlap(player, zone, () => {
        ui.setPrompt('按 E 对话');
        if (enterKey.isDown) {
          sfx('blip');
          ui.show(n.text);
          scene.time.delayedCall(1600, () => ui.hide());
        }
      });
    });

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

    // Banner
    if (config.banner) {
      const t = scene.add.text(WORLD_WIDTH / 2, 120, config.banner, {
        fontSize: '22px', color: '#ffd48a', fontFamily: 'Orbitron, sans-serif'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
      scene.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: 400 });
      scene.time.delayedCall(1800, () => scene.tweens.add({ targets: t, alpha: 0, duration: 600 }));
    }

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
    const scale = 0.5 + 1.5 * yRatio; // stronger near/far scaling for a 2.5D feel
    player.setScale(scale);
    player.setDepth(player.y);

    // Shadow follows player and scales softer
    if (shadow) {
      shadow.setPosition(player.x, player.y + 14);
      shadow.setDepth(player.y - 1);
      shadow.setScale(0.45 + 1.1 * yRatio);
      shadow.setAlpha(0.18 + 0.12 * yRatio);
    }

    // Camera slight tilt by velocity
    const cam = scene.cameras.main;
    cam.setLerp(0.12, 0.12);
    // Slight dynamic zoom by Y to accentuate perspective
    cam.setZoom(1.05 + 0.15 * yRatio + 0.03 * (isDashing ? 1 : 0));
    cam.rotation = Phaser.Math.Angle.RotateTo(cam.rotation, Phaser.Math.Angle.Wrap(Math.atan2(nextVx, -nextVy) * 0.03), 0.0008 * delta);
  };

  // Expose a clean API
  return scene;
}


