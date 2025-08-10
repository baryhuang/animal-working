import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { createSimpleNpc, SimpleNpc } from './actors';
import { createTaskList, TaskListHandle } from './panel';
import { sfx, startBGMFromUrl } from './audio';

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
  let player!: Phaser.GameObjects.Sprite;
  let interactKey!: Phaser.Input.Keyboard.Key;
  let cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  let bgWidth = 1600;
  let bgHeight = 900;
  let minX = 60, maxX = 1540;
  let minY = 0, maxY = 0;
  let taskPanel!: TaskListHandle;

  // CTO sprite and timers
  let cto!: SimpleNpc;
  let pm!: SimpleNpc;
  let designer!: SimpleNpc;
  let speakTimer: Phaser.Time.TimerEvent | null = null;
  let pmSpeakTimer: Phaser.Time.TimerEvent | null = null;
  let designerSpeakTimer: Phaser.Time.TimerEvent | null = null;
  let designerChoiceOpen = false;
  let designerCooldownAt = 0;

  const officeUrl = new URL('./assets/office.png', import.meta.url).toString();
  const ctoUrl = new URL('./assets/cto.png', import.meta.url).toString();
  const playerUrl = new URL('./assets/player.png', import.meta.url).toString();
  const pmUrl = new URL('./assets/product_manager.png', import.meta.url).toString();
  const designerUrl = new URL('./assets/designer.png', import.meta.url).toString();

  // Using 'as any' to attach lifecycle functions to the Scene instance to satisfy TS typings
  ;(scene as any).preload = () => {
    scene.load.image('office_bg', officeUrl);
    scene.load.image('cto_raw', ctoUrl);
    scene.load.image('player_raw', playerUrl);
    scene.load.image('pm_raw', pmUrl);
    scene.load.image('designer_raw', designerUrl);
    scene.load.image('task_list', new URL('./assets/task_list.png', import.meta.url).toString());
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
    cto = createSimpleNpc(scene, {
      x: ctoX,
      y: ctoY,
      sheetKey: 'cto',
      idleFrame: 3,
      speakFrame: 1,
      blinkFrame: 2,
      perspective: { worldHeight: bgHeight, min: 0.16, max: 0.46 },
      bob: { amplitude: 1, durationMs: 1800 }
    });
  }

  function setupPMSprite(): void {
    const raw = scene.textures.get('pm_raw').getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(raw.width / 2);
    const frameHeight = Math.floor(raw.height / 2);
    if (!scene.textures.exists('pm')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scene.textures as any).addSpriteSheet('pm', raw, { frameWidth, frameHeight, endFrame: 3 });
    }
    // Move PM further left and slightly closer to camera
    const pmX = Math.floor(bgWidth * 0.30);
    const pmY = Math.floor(bgHeight * 0.78);
    pm = createSimpleNpc(scene, {
      x: pmX,
      y: pmY,
      sheetKey: 'pm',
      idleFrame: 3,
      speakFrame: 1,
      blinkFrame: 2,
      perspective: { worldHeight: bgHeight, min: 0.16, max: 0.46 },
      bob: { amplitude: 1, durationMs: 1800 }
    });
  }

  function setupDesignerSprite(): void {
    const raw = scene.textures.get('designer_raw').getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(raw.width / 2);
    const frameHeight = Math.floor(raw.height / 2);
    if (!scene.textures.exists('designer')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scene.textures as any).addSpriteSheet('designer', raw, { frameWidth, frameHeight, endFrame: 3 });
    }
    // Place designer towards front-right area
    const dx = Math.floor(bgWidth * 0.84);
    const dy = Math.floor(bgHeight * 0.82);
    designer = createSimpleNpc(scene, {
      x: dx,
      y: dy,
      sheetKey: 'designer',
      idleFrame: 3, // 右下（第4张）
      speakFrame: 1, // 右上（第2张）
      blinkFrame: 2,
      speakMode: 'hold',
      perspective: { worldHeight: bgHeight, min: 0.16, max: 0.46 },
      bob: { amplitude: 1, durationMs: 1800 }
    });
  }

  function setupPlayerSprite(spawnX: number, groundY: number): void {
    const raw = scene.textures.get('player_raw').getSourceImage() as HTMLImageElement;
    const frameWidth = Math.floor(raw.width / 2);
    const frameHeight = Math.floor(raw.height / 2);
    if (!scene.textures.exists('player')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scene.textures as any).addSpriteSheet('player', raw, { frameWidth, frameHeight, endFrame: 3 });
    }
    player = scene.add.sprite(spawnX, groundY, 'player', 0).setOrigin(0.5, 1).setDepth(1000);
    // Smooth scaling for crisper resampling
    player.setPipeline('TextureTintPipeline');
    player.setScale(0.8);
  }

  function startSpeaking(): void {
    if (speakTimer) return; // already speaking
    let flag = true;
    cto.startSpeaking();
    speakTimer = scene.time.addEvent({
      delay: Phaser.Math.Between(300, 500),
      loop: true,
      callback: () => { flag = !flag; }
    });
  }

  function stopSpeaking(): void {
    if (speakTimer) { speakTimer.remove(false); speakTimer = null; }
    cto.stopSpeaking();
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
    // Start BGM from asset file
    const bgmUrl = new URL('./assets/bgm.mp3', import.meta.url).toString();
    startBGMFromUrl(bgmUrl, 0.12);

    // Player spawn调整到更靠下并靠右，便于直接走向 CTO
    const groundY = Math.floor(bgHeight * 0.86);
    const spawnX = Math.floor(bgWidth * 0.58);
    setupPlayerSprite(spawnX, groundY);
    // Movement bounds & perspective band
    minX = 60; maxX = bgWidth - 60;
    minY = Math.floor(bgHeight * 0.58);
    maxY = Math.floor(bgHeight * 0.90);

    // Controls
    cursors = scene.input.keyboard!.createCursorKeys();
    const keys = scene.input.keyboard!.addKeys('E') as Record<string, Phaser.Input.Keyboard.Key>;
    interactKey = keys.E;

    // Set camera to follow
    scene.cameras.main.startFollow(player, true, 0.15, 0.15, 0, 120);

    // CTO sprite and idle loop
    setupCtoSprite();
    setupPMSprite();
    setupDesignerSprite();

    // Hint
    ui.setPrompt('靠近 CTO（右上区域） · 按 E 交互');

    // Task list panel
    taskPanel = createTaskList(scene, { x: 16, y: 16, scale: 0.36 });
    taskPanel.setTasks(['与 CTO 打招呼', '与 PM 沟通需求', '与 设计师 对齐 UI']);
  };

  ;(scene as any).update = (_time: number, delta: number) => {
    if (!player || !cto) return;

    // 4 方向移动（仅方向键）
    const left = cursors.left?.isDown;
    const right = cursors.right?.isDown;
    const up = cursors.up?.isDown;
    const down = cursors.down?.isDown;
    const speed = 320;
    const dt = delta / 1000;
    let vx = 0;
    let vy = 0;
    if (left) vx -= speed;
    if (right) vx += speed;
    if (up) vy -= speed;
    if (down) vy += speed;
    // 归一化对角速度
    if (vx !== 0 && vy !== 0) { const inv = 1 / Math.sqrt(2); vx *= inv; vy *= inv; }
    // 允许在背景区域内自由移动
    player.x = Phaser.Math.Clamp(player.x + vx * dt, minX, maxX);
    player.y = Phaser.Math.Clamp(player.y + vy * dt, minY, maxY);
    // 行走动画：水平用帧 0/1，垂直用帧 2/3
    const moving = Math.abs(vx) + Math.abs(vy) > 1;
    if (moving) {
      const useHorizontal = Math.abs(vx) >= Math.abs(vy);
      const t = Math.floor(scene.time.now / 140) % 2;
      if (useHorizontal) {
        player.setFlipX(vx < 0);
        player.setFrame(t === 0 ? 0 : 1);
      } else {
        player.setFlipX(false);
        player.setFrame(t === 0 ? 2 : 3);
      }
    } else {
      player.setFrame(0);
    }

    // 伪透视缩放：越靠下越大
    const t = Phaser.Math.Clamp((player.y - minY) / (maxY - minY), 0, 1);
    const scale = 0.48 + 0.16 * t; // 更平坦：0.48 (远) → 0.64 (近)
    player.setScale(scale);
    player.setDepth(player.y);

    // Idle微抖动/呼吸：玩家在静止时轻微上下浮动（更小幅度）
    if (!moving) {
      player.y += Math.sin(scene.time.now * 0.006) * 0.18;
    }

    // Proximity + dialog
    let prompt: string | null = null;
    const nearCto = Math.hypot(player.x - cto.sprite.x, player.y - cto.sprite.y) < 120;
    const nearPm = pm ? Math.hypot(player.x - pm.sprite.x, player.y - pm.sprite.y) < 120 : false;
    const nearDesigner = designer ? Math.hypot(player.x - designer.sprite.x, player.y - designer.sprite.y) < 120 : false;
    if (nearCto) {
      prompt = '按 E 与 CTO 交谈';
      if (interactKey.isDown && !speakTimer) {
        startSpeaking();
        sfx('talk');
        ui.show(['CTO: 欢迎加入！', '有问题随时来找我。']);
        scene.time.delayedCall(1400, () => {
          ui.hide();
          stopSpeaking();
          taskPanel.setDone(0, true);
          sfx('check');
        });
      }
    } else if (nearPm) {
      prompt = '按 E 与 PM 交谈';
      if (interactKey.isDown && !pmSpeakTimer) {
        pm.startSpeaking();
        sfx('talk');
        ui.show(['PM: 你好，我是产品经理。', '先去和 CTO 打个招呼吧～']);
        pmSpeakTimer = scene.time.delayedCall(1400, () => {
          ui.hide();
          pm.stopSpeaking();
          pmSpeakTimer = null;
          taskPanel.setDone(1, true);
          sfx('check');
        });
      }
    } else if (nearDesigner) {
      // Auto-open choice dialog when near designer
      prompt = null;
      if (!designerChoiceOpen && scene.time.now - designerCooldownAt > 800) {
        designerChoiceOpen = true;
        designer.startSpeaking();
        sfx('talk');
        ui.ask?.('需要我帮你看看设计吗？', ['没事了', '我想问你一下设计问题']).then(idx => {
          designer.stopSpeaking();
          if (idx === 1) {
            ui.show(['设计师: 好的，说说你的想法。', '我们可以从信息层级和对比开始。']);
            scene.time.delayedCall(1400, () => ui.hide());
            taskPanel.setDone(2, true);
            sfx('check');
          } else {
            ui.hide();
          }
          designerCooldownAt = scene.time.now;
          designerChoiceOpen = false;
        });
      }
    } else {
      // Left the designer zone: close chooser if open
      if (designerChoiceOpen) {
        ui.cancelAsk?.();
        designer.stopSpeaking();
        designerChoiceOpen = false;
        designerCooldownAt = scene.time.now;
      }
    }
    ui.setPrompt(prompt);
  };

  return scene;
}


