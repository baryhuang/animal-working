import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';

export type DoorConfig = {
  x: number;
  label: string;
  target: string;
  isLocked?: () => { locked: boolean; reason?: string };
};

export type NpcConfig = {
  x: number;
  name?: string;
  lines?: string[];
  onInteract?: (scene: Phaser.Scene, ui: DialogHandle) => Promise<void> | void;
};

export type SideSceneConfig = {
  name: string;
  banner?: string;
  spawnX?: number;
  width?: number;
  doors?: DoorConfig[];
  npcs?: NpcConfig[];
  onEnter?: (scene: Phaser.Scene, ui: DialogHandle) => Promise<void> | void;
};

const DEFAULT_WORLD_WIDTH = 2800;
const GROUND_Y = 560;

function createHeroTexture(scene: Phaser.Scene): string {
  const key = 'hero_side';
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  g.fillStyle(0x66d9ef, 1);
  g.fillRoundedRect(0, 0, 28, 44, 8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(14, 10, 7);
  g.lineStyle(2, 0x0b0d13, 0.25);
  g.strokeRoundedRect(0, 0, 28, 44, 8);
  g.generateTexture(key, 28, 44);
  g.destroy();
  return key;
}

function createDoorTexture(scene: Phaser.Scene): string {
  const key = 'door';
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  g.fillStyle(0x2a2f35, 1);
  g.fillRoundedRect(0, 0, 60, 120, 6);
  g.lineStyle(2, 0x4a515b, 1);
  g.strokeRoundedRect(0, 0, 60, 120, 6);
  g.fillStyle(0xa0b4c0, 1);
  g.fillCircle(48, 60, 4);
  g.generateTexture(key, 60, 120);
  g.destroy();
  return key;
}

function createBackdrop(scene: Phaser.Scene, worldWidth: number): void {
  const { width, height } = scene.scale;
  const bg = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setScrollFactor(0);
  const grad = scene.add.graphics();
  const top = 0x10131a;
  const bottom = 0x0b0d13;
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

  // Floor strip
  const floor = scene.add.graphics();
  floor.fillStyle(0x1a2028, 1);
  floor.fillRect(0, GROUND_Y + 20, worldWidth, 160);
  floor.setScrollFactor(1, 0);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createSideScene(cfg: SideSceneConfig): Phaser.Scene {
  let ui!: DialogHandle;
  let player!: Phaser.GameObjects.Image;
  let interactKey!: Phaser.Input.Keyboard.Key;
  let cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  let wasd!: Record<'A' | 'D', Phaser.Input.Keyboard.Key>;
  let lastInteractAt = 0;

  const worldWidth = cfg.width ?? DEFAULT_WORLD_WIDTH;

  const scene = new Phaser.Scene(cfg.name);

  ;(scene as any).preload = () => {
    createHeroTexture(scene);
    createDoorTexture(scene);
  };

  ;(scene as any).create = () => {
    ui = createUI();
    createBackdrop(scene, worldWidth);

    // Camera & world bounds (horizontal only)
    scene.cameras.main.setBackgroundColor('#0e1014');
    scene.cameras.main.setBounds(0, 0, worldWidth, scene.scale.height);

    // Player
    const spawnX = cfg.spawnX ?? 200;
    player = scene.add.image(spawnX, GROUND_Y, 'hero_side')
      .setOrigin(0.5, 1)
      .setDepth(1000);

    // Doors
    const doorSprites: { x: number; target: string; label: string; isLocked?: DoorConfig['isLocked']; text: Phaser.GameObjects.Text }[] = [];
    (cfg.doors ?? []).forEach(d => {
      const door = scene.add.image(d.x, GROUND_Y + 2, 'door').setOrigin(0.5, 1).setDepth(900);
      const label = scene.add.text(d.x, GROUND_Y + 10, d.label, {
        fontSize: '14px',
        color: '#ffd48a',
        fontFamily: 'Inter, sans-serif'
      }).setOrigin(0.5, 0).setDepth(901);
      doorSprites.push({ x: d.x, target: d.target, label: d.label, isLocked: d.isLocked, text: label });
    });

    // NPCs
    const npcs = (cfg.npcs ?? []).map(n => {
      const spr = scene.add.circle(n.x, GROUND_Y - 44, 18, 0x8bd6ff).setDepth(950);
      const nameText = n.name ? scene.add.text(n.x, GROUND_Y - 88, n.name, { fontSize: '12px', color: '#a8f0ff', fontFamily: 'Inter, sans-serif' }).setOrigin(0.5, 1).setDepth(951) : null;
      return { config: n, x: n.x, spr, nameText };
    });

    // Controls
    cursors = scene.input.keyboard!.createCursorKeys();
    const keys = scene.input.keyboard!.addKeys('A,D,E') as Record<string, Phaser.Input.Keyboard.Key>;
    wasd = { A: keys.A, D: keys.D } as any;
    interactKey = keys.E;

    // Banner
    if (cfg.banner) {
      const t = scene.add.text(scene.scale.width / 2, 110, cfg.banner, {
        fontSize: '22px', color: '#ffd48a', fontFamily: 'Orbitron, sans-serif'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
      scene.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: 400 });
      scene.time.delayedCall(1800, () => scene.tweens.add({ targets: t, alpha: 0, duration: 600 }));
    }

    scene.cameras.main.startFollow(player, true, 0.15, 0.15, 0, 120);

    // Scene hook
    if (cfg.onEnter) cfg.onEnter(scene, ui);
  };

  ;(scene as any).update = (_time: number, delta: number) => {
    if (!player) return;

    // Movement
    const left = cursors.left?.isDown || wasd.A?.isDown;
    const right = cursors.right?.isDown || wasd.D?.isDown;
    const speed = 340;
    const dt = delta / 1000;
    let vx = 0;
    if (left) vx -= speed;
    if (right) vx += speed;
    player.x = clamp(player.x + vx * dt, 40, (cfg.width ?? DEFAULT_WORLD_WIDTH) - 40);

    // Head bob
    player.y = GROUND_Y - (Math.abs(vx) > 1 ? Math.sin(scene.time.now * 0.015) * 2 : 0);

    // Proximity prompts
    let prompt: string | null = null;
    const nearThreshold = 60;

    // Doors
    (cfg.doors ?? []).forEach(d => {
      const dist = Math.abs(player.x - d.x);
      if (dist < nearThreshold) {
        const lockedInfo = d.isLocked?.();
        if (lockedInfo?.locked) {
          prompt = `门已锁 · ${lockedInfo.reason ?? ''}`.trim();
        } else {
          prompt = `按 E 进入 · ${d.label}`;
          if (interactKey.isDown && scene.time.now - lastInteractAt > 300) {
            lastInteractAt = scene.time.now;
            scene.scene.start(d.target);
          }
        }
      }
    });

    // NPCs
    (cfg.npcs ?? []).forEach(n => {
      const dist = Math.abs(player.x - n.x);
      if (dist < nearThreshold) {
        prompt = '按 E 交互';
        if (interactKey.isDown && scene.time.now - lastInteractAt > 300) {
          lastInteractAt = scene.time.now;
          if (n.onInteract) {
            Promise.resolve(n.onInteract(scene, ui));
          } else if (n.lines) {
            ui.show(n.lines);
            scene.time.delayedCall(1600, () => ui.hide());
          }
        }
      }
    });

    ui.setPrompt(prompt);
  };

  return scene;
}


