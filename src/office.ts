import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { createSimpleNpc, SimpleNpc } from './actors';
import { createTaskList, TaskListHandle } from './panel';
import { sfx } from './audio';
import { startOpenAiVoiceSession, VoiceSession, RealtimeTool } from './realtime';
import { fadeToScene } from './transition';
import { getState, setPlayerProfile, addClue, advanceHour, getFlag, setFlag } from './state';

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
  let voice!: VoiceSession | null;
  // Prefer env var, then localStorage('oaiKey'), then window.OPENAI_API_KEY for dev
  let openAiKey: string | null =
    ((import.meta as any)?.env?.VITE_OPENAI_API_KEY as string | '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') ??
    (localStorage.getItem('oaiKey') as string | null) ??
    ((window as any).OPENAI_API_KEY as string | null) ??
    null;

  // Sticky prompt helper
  let stickyPromptText: string | null = null;
  let stickyPromptUntil = 0;
  const setStickyPrompt = (text: string, ms = 1800) => {
    stickyPromptText = text;
    stickyPromptUntil = Date.now() + ms;
  };

  // Voice status chip element
  let voiceChip: HTMLElement | null = null;
  let voiceChipLabelEl: HTMLElement | null = null;
  const ensureVoiceChip = () => {
    if (!voiceChip) {
      voiceChip = document.createElement('div');
      voiceChip.className = 'voicechip';
      const dot = document.createElement('span');
      dot.className = 'dot';
      voiceChipLabelEl = document.createElement('span');
      voiceChipLabelEl.className = 'label';
      voiceChip.appendChild(dot);
      voiceChip.appendChild(voiceChipLabelEl);
      document.body.appendChild(voiceChip);
    }
  };
  const setVoiceChip = (active: boolean, label = 'Voice') => {
    ensureVoiceChip();
    if (!voiceChip) return;
    if (voiceChipLabelEl) voiceChipLabelEl.textContent = label;
    if (active) voiceChip.classList.add('active'); else voiceChip.classList.remove('active');
  };

  // CTO sprite and timers
  let cto!: SimpleNpc;
  let pm!: SimpleNpc;
  let designer!: SimpleNpc;
  let speakTimer: Phaser.Time.TimerEvent | null = null;
  let pmSpeakTimer: Phaser.Time.TimerEvent | null = null;
  let designerSpeakTimer: Phaser.Time.TimerEvent | null = null;
  let designerChoiceOpen = false;
  let designerCooldownAt = 0;
  let isVoiceConnecting = false;
  let designerVoice: VoiceSession | null = null;
  let isDesignerConnecting = false;

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
    // 0: laptop | 1: talk+gesture
    // 2: adjust glasses | 3: idle smile

    // Create a persistent sprite
    const ctoX = Math.floor(bgWidth * 0.69);
    // slightly higher
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
      idleFrame: 3, // bottom-right
      speakFrame: 1, // top-right
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
    // BGM disabled temporarily

    // Player spawn lower-right, close to CTO path
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

    // Start modal, then prime UI prompt
    ui.showStartModal!((company, role, name) => {
      setPlayerProfile(name, company, role);
      ui.setPrompt(`Welcome ${name} · Approach CTO (top-right) or press E to talk`);
    });

    // Task list panel
    taskPanel = createTaskList(scene, { x: 16, y: 16, scale: 0.36 });
    taskPanel.setTasks(['Talk to CTO', 'Talk to PM', 'Talk to Designer']);
  };

  ;(scene as any).update = (_time: number, delta: number) => {
    if (!player || !cto) return;

    // 4-direction move (arrow keys only)
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
    // normalize diagonal
    if (vx !== 0 && vy !== 0) { const inv = 1 / Math.sqrt(2); vx *= inv; vy *= inv; }
    // clamp to background region
    player.x = Phaser.Math.Clamp(player.x + vx * dt, minX, maxX);
    player.y = Phaser.Math.Clamp(player.y + vy * dt, minY, maxY);
    // Walk anim: horizontal frames 0/1; vertical frames 2/3
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

    // Fake perspective: lower = larger
    const t = Phaser.Math.Clamp((player.y - minY) / (maxY - minY), 0, 1);
    const scale = 0.48 + 0.16 * t; // flatter: 0.48 (far) → 0.64 (near)
    player.setScale(scale);
    player.setDepth(player.y);

    // Idle micro breathing when not moving
    if (!moving) {
      player.y += Math.sin(scene.time.now * 0.006) * 0.18;
    }

    // Proximity + dialog
    let prompt: string | null = null;
    const nearCto = Math.hypot(player.x - cto.sprite.x, player.y - cto.sprite.y) < 120;
    const nearPm = pm ? Math.hypot(player.x - pm.sprite.x, player.y - pm.sprite.y) < 120 : false;
    const nearDesigner = designer ? Math.hypot(player.x - designer.sprite.x, player.y - designer.sprite.y) < 120 : false;
    // openAiKey can be provided via env/localStorage; don't overwrite here
    openAiKey = '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';
    if (nearCto) {
      prompt = 'Approach CTO · voice will start (press E for text)';
      // Auto-start voice once when near CTO
      if (!voice?.isActive?.() && !isVoiceConnecting) {
        isVoiceConnecting = true;
        if (openAiKey) {
          setStickyPrompt('Connecting voice…', 2500);
          startOpenAiVoiceSession(
            openAiKey,
            'You are the CTO. Be concise and kind. Guide the intern to ship a thin MVP slice today.',
            'gpt-4o-realtime-preview',
            'onyx'
          )
            .then(v => {
              voice = v;
              setStickyPrompt('Voice connected — speak to continue', 2500);
              setVoiceChip(true);
              // dual greeting
              v.say('Good to see you. Start with scope, design, or metrics?');
              scene.time.delayedCall(500, () => voice?.say('If you can hear me, just start talking.'));
            })
            .catch(() => setStickyPrompt('Voice connection failed', 2500))
            .finally(() => { isVoiceConnecting = false; });
        } else {
          setStickyPrompt('Missing OpenAI Key. Set localStorage oaiKey then reload.', 3500);
          isVoiceConnecting = false;
        }
      }
      // Optional text welcome via E
      if (interactKey.isDown && !speakTimer) {
        startSpeaking();
        sfx('talk');
        ui.show(['CTO: Welcome!', 'Ping me if I have my headset on—give me a minute.']);
        scene.time.delayedCall(1400, () => {
          ui.hide();
          stopSpeaking();
          taskPanel.setDone(0, true);
          sfx('check');
        });
      }
    } else if (nearPm) {
      prompt = 'Press E to talk to PM';
      if (interactKey.isDown && !pmSpeakTimer) {
        pm.startSpeaking();
        sfx('talk');
        ui.show(['PM: We’re redesigning Candidate Dashboard for faster decisions.', 'Your MVP should demonstrate value, mocks are fine.']);
        pmSpeakTimer = scene.time.delayedCall(1400, () => {
          ui.hide();
          pm.stopSpeaking();
          pmSpeakTimer = null;
          taskPanel.setDone(1, true);
          sfx('check');
        });
      }
    } else if (nearDesigner) {
      prompt = 'Approach Designer · voice starts automatically';
      if (!designerVoice?.isActive?.() && !isDesignerConnecting) {
        isDesignerConnecting = true;
        const tools: RealtimeTool[] = [
          {
            name: 'go_to_meeting',
            description: 'Call when we should go to the meeting room for deeper design discussion',
            parameters: { type: 'object', properties: { reason: { type: 'string' } } },
            handler: () => fadeToScene(scene, 'DesignerMeeting', { duration: 420 })
          }
        ];
        const key = openAiKey!;
        startOpenAiVoiceSession(key, 'You are a friendly female designer. Offer help, and call go_to_meeting when the user wants to go deeper.', 'gpt-4o-realtime-preview', 'verse', tools)
          .then(v => { designerVoice = v; setVoiceChip(true, 'Talking with Designer'); v.say('Hey! Want to walk through the design and questions?'); })
          .catch(() => setStickyPrompt('Designer voice failed', 2000))
          .finally(() => { isDesignerConnecting = false; });
      }
    } else {
      // Left the designer zone: close chooser if open
      if (designerChoiceOpen) {
        ui.cancelAsk?.();
        designer.stopSpeaking();
        designerChoiceOpen = false;
        designerCooldownAt = scene.time.now;
      }
      // If moved away from CTO, stop voice session
      if (voice?.isActive?.() && !(Math.hypot(player.x - cto.sprite.x, player.y - cto.sprite.y) < 140)) {
        voice.stop();
        voice = null;
        setVoiceChip(false);
      }
      if (designerVoice?.isActive?.() && !(Math.hypot(player.x - designer.sprite.x, player.y - designer.sprite.y) < 140)) {
        designerVoice.stop();
        designerVoice = null;
        setVoiceChip(false);
      }
    }
    // Apply sticky prompt override
    if (Date.now() < stickyPromptUntil && stickyPromptText) {
      ui.setPrompt(stickyPromptText);
    } else {
      stickyPromptText = null;
      ui.setPrompt(prompt);
    }
  };

  return scene;
}


