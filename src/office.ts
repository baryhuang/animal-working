import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';

// Simple side-view player for the demo
function createHeroTexture(scene: Phaser.Scene): string {
  const key = 'hero_office';
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

export function createOfficeScene(): Phaser.Scene {
  const scene = new Phaser.Scene('Office');

  let ui!: DialogHandle;
  let player!: Phaser.GameObjects.Image;
  let interactKey!: Phaser.Input.Keyboard.Key;
  let cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  let wasd!: Record<'A' | 'D', Phaser.Input.Keyboard.Key>;

  let bgWidth = 1600;
  let bgHeight = 900;

  // CTO sprite and timers
  let cto!: Phaser.GameObjects.Sprite;
  let idleBlinkTimer: Phaser.Time.TimerEvent | null = null;
  let speakTimer: Phaser.Time.TimerEvent | null = null;

  const officeUrl = new URL('./assets/office.png', import.meta.url).toString();
  const ctoUrl = new URL('./assets/cto.png', import.meta.url).toString();

  // Using 'as any' to attach lifecycle functions to the Scene instance to satisfy TS typings
  ;(scene as any).preload = () => {
    createHeroTexture(scene);
    scene.load.image('office_bg', officeUrl);
    scene.load.image('cto_raw', ctoUrl);
  };

  function setupCtoSprite(): void {
    const raw = scene.textures.get('cto_raw').getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(raw.width / 2);
    const frameHeight = Math.floor(raw.height / 2);
    // Build a spritesheet from the loaded image at runtime
    if (!scene.textures.exists('cto')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scene.textures as any).addSpriteSheet('cto', raw, { frameWidth, frameHeight, endFrame: 3 });
    }

    // Frame index mapping (2x2):
    // 0: 工作(笔记本) | 1: 讲话+举手
    // 2: 扶眼镜        | 3: 静态微笑(Idle)

    // Create a persistent sprite
    const ctoX = Math.floor(bgWidth * 0.69);
    // 稍微上移
    const ctoY = Math.floor(bgHeight * 0.68);
    cto = scene.add.sprite(ctoX, ctoY, 'cto', 3).setOrigin(0.5, 1).setDepth(ctoY);

    const perspectiveScale = (y: number) => 0.16 + 0.30 * (y / bgHeight);
    cto.setScale(perspectiveScale(ctoY) * 1.20);

    // Subtle bobbing
    scene.tweens.add({
      targets: cto,
      y: ctoY + 1,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Idle blink / adjust-glasses occasionally
    const scheduleBlink = () => {
      const delay = Phaser.Math.Between(3000, 5000);
      idleBlinkTimer = scene.time.delayedCall(delay, () => {
        cto.setFrame(2);
        scene.time.delayedCall(220, () => cto.setFrame(3));
        scheduleBlink();
      });
    };
    scheduleBlink();
  }

  function startSpeaking(): void {
    if (speakTimer) return; // already speaking
    // Switch between speaking(1) and idle(3) quickly
    cto.setFrame(1);
    let speakOn = true;
    speakTimer = scene.time.addEvent({
      delay: Phaser.Math.Between(300, 500),
      loop: true,
      callback: () => {
        speakOn = !speakOn;
        cto.setFrame(speakOn ? 1 : 3);
      }
    });
  }

  function stopSpeaking(): void {
    if (speakTimer) {
      speakTimer.remove(false);
      speakTimer = null;
    }
    cto.setFrame(3);
  }

  ;(scene as any).create = () => {
    ui = createUI();

    // Background image
    const bgTex = scene.textures.get('office_bg').getSourceImage() as HTMLImageElement;
    bgWidth = bgTex.width;
    bgHeight = bgTex.height;

    scene.cameras.main.setBounds(0, 0, bgWidth, bgHeight);
    scene.cameras.main.setBackgroundColor('#0e1014');

    scene.add.image(0, 0, 'office_bg').setOrigin(0, 0).setDepth(-1000);

    // Player spawn调整到更靠下并靠右，便于直接走向 CTO
    const groundY = Math.floor(bgHeight * 0.86);
    const spawnX = Math.floor(bgWidth * 0.58);
    player = scene.add.image(spawnX, groundY, 'hero_office').setOrigin(0.5, 1).setDepth(1000);

    // Controls
    cursors = scene.input.keyboard!.createCursorKeys();
    const keys = scene.input.keyboard!.addKeys('A,D,E') as Record<string, Phaser.Input.Keyboard.Key>;
    wasd = { A: keys.A, D: keys.D } as any;
    interactKey = keys.E;

    // Set camera to follow
    scene.cameras.main.startFollow(player, true, 0.15, 0.15, 0, 120);

    // CTO sprite and idle loop
    setupCtoSprite();

    // Hint
    ui.setPrompt('靠近 CTO（右上区域） · 按 E 交互');
  };

  ;(scene as any).update = (_time: number, delta: number) => {
    if (!player || !cto) return;

    // Horizontal movement
    const left = cursors.left?.isDown || wasd.A?.isDown;
    const right = cursors.right?.isDown || wasd.D?.isDown;
    const speed = 340;
    const dt = delta / 1000;
    let vx = 0;
    if (left) vx -= speed;
    if (right) vx += speed;
    player.x = Phaser.Math.Clamp(player.x + vx * dt, 40, bgWidth - 40);
    // Simple head bob while moving
    const baseGround = Math.floor(bgHeight * 0.86);
    player.y = baseGround - (Math.abs(vx) > 1 ? Math.sin(scene.time.now * 0.015) * 2 : 0);

    // Proximity + dialog
    // 触发范围稍大以提升易用性
    const near = Math.abs(player.x - cto.x) < 100;
    if (near) {
      ui.setPrompt('按 E 与 CTO 交谈');
      if (interactKey.isDown && !speakTimer) {
        startSpeaking();
        ui.show(['CTO: 欢迎加入！', '有问题随时来找我。']);
        scene.time.delayedCall(1400, () => {
          ui.hide();
          stopSpeaking();
        });
      }
    }
  };

  return scene;
}


