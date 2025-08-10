import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { createSimpleNpc, SimpleNpc } from './actors';
import { createTaskList, TaskListHandle } from './panel';
import { sfx } from './audio';
import { startOpenAiVoiceSession, VoiceSession, RealtimeTool } from './realtime';
import { fadeToScene } from './transition';
import { getState, setPlayerProfile, addClue, advanceHour, getFlag, setFlag, addPoints, computeFinalRating } from './state';

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
  let pmVoice: VoiceSession | null = null;
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
  let isPmConnecting = false;

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

  let victoryShownAt = 0;

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

    // Start modal once; skip when returning to Office
    if (!getFlag('started')) {
      ui.showStartModal!((company, role, name) => {
        setPlayerProfile(name, company, role);
        setFlag('started', true);
        ui.setPrompt(`Welcome ${name} · Approach CTO (top-right) or press E to talk`);
      });
    } else {
      const s = getState();
      ui.setPrompt(`Welcome back, ${s.playerName} · Approach CTO/PM/Designer`);
    }

    // Task list panel
    taskPanel = createTaskList(scene, { x: 16, y: 16, scale: 0.36 });
    taskPanel.setTasks(['Talk to CTO', 'Talk to PM', 'Talk to Designer']);

    // Initialize scoreboard/clues HUD
    refreshHud();
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
          const tools: RealtimeTool[] = buildCommonTools('CTO');
          startOpenAiVoiceSession(
            openAiKey,
            buildCtoInstructions(),
            'gpt-4o-realtime-preview',
            'onyx',
            tools
          )
            .then(v => {
              voice = v;
              setStickyPrompt('Voice connected — speak to continue', 2500);
              setVoiceChip(true);
              taskPanel.setDone(0, true);
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
      prompt = 'Approach PM · voice starts automatically';
      if (!pmVoice?.isActive?.() && !isPmConnecting) {
        isPmConnecting = true;
        const key = openAiKey!;
        const tools: RealtimeTool[] = buildCommonTools('PM');
        startOpenAiVoiceSession(
          key,
          buildPmInstructions(),
          'gpt-4o-realtime-preview',
          'alloy',
          tools
        )
          .then(v => { pmVoice = v; setVoiceChip(true, 'Talking with PM'); taskPanel.setDone(1, true); v.say('Hi! Let’s align on the Candidate Dashboard MVP goals.'); })
          .catch(() => setStickyPrompt('PM voice failed', 2000))
          .finally(() => { isPmConnecting = false; });
      }
    } else if (nearDesigner) {
      prompt = 'Approach Designer · voice starts automatically';
      if (!designerVoice?.isActive?.() && !isDesignerConnecting) {
        isDesignerConnecting = true;
        const tools: RealtimeTool[] = [
          ...buildCommonTools('Designer'),
          {
            name: 'go_to_meeting',
            description: 'Call when we should go to the meeting room for deeper design discussion',
            parameters: { type: 'object', properties: { reason: { type: 'string' } } },
            handler: () => fadeToScene(scene, 'DesignerMeeting', {
              duration: 420,
              onBeforeStart: () => {
                // Award for initiating a UI review meeting
                handleAddClue({ id: 'initiated_ui_review_meeting' });
                // Stop any active office voice sessions before entering meeting
                try { designerVoice?.stop(); } catch {}
                try { pmVoice?.stop(); } catch {}
                try { voice?.stop(); } catch {}
                designerVoice = null;
                pmVoice = null;
                voice = null;
                setVoiceChip(false);
                advanceHour(1);
                refreshHud();
              }
            })
          }
        ];
        const key = openAiKey!;
        startOpenAiVoiceSession(key, buildDesignerInstructions(), 'gpt-4o-realtime-preview', 'verse', tools)
          .then(v => { designerVoice = v; setVoiceChip(true, 'Talking with Designer'); taskPanel.setDone(2, true); v.say('Hey! Want to walk through the design and questions?'); })
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
      if (pmVoice?.isActive?.() && !(Math.hypot(player.x - pm.sprite.x, player.y - pm.sprite.y) < 140)) {
        pmVoice.stop();
        pmVoice = null;
        setVoiceChip(false);
      }
    }
    // Victory restart handling
    if (getFlag('victory') && interactKey.isDown && scene.time.now - victoryShownAt > 500) {
      try { window.location.reload(); } catch {}
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

// --- Helpers and realtime tool builders ---
function refreshHud(): void {
  const s = getState();
  // Use createUI singleton to set clues; the UI instance is bound above as 'ui'
  // We call via DOM each time using a lightweight re-fetch to avoid capturing 'ui' here.
  const panel = document.getElementById('hud'); // not used; ensure UI exists
  const uiHandle = (createUI && (createUI as any).lastInstance) ? (createUI as any).lastInstance : null;
  // Fallback: call a new instance's setClues via the global dialog created by createUI
  try {
    // We can directly update via the UI we already created in scene lifecycle
  } catch {}
  // Update via minimal coupling: call setClues on the most recent UI instance if exposed
  // Since we cannot access ui here, we instead duplicate the logic inline by calling createUI again and using its setClues.
  const ui = createUI();
  const items = Array.from(s.clues).map(id => CLUE_LABELS[id] ?? id);
  ui.setClues?.(items, s.score, s.hour);
}

const CLUE_POINTS: Record<string, number> = {
  confirmed_deadline_today: 10,
  aligned_scope_thin_slice: 10,
  defined_success_criteria: 10,
  obtained_figma_file: 10,
  show_top_skill_badge: 10,
  jump_back_to_last_candidate: 10,
  pm_reprioritized: 10,
  initiated_ui_review_meeting: 10
};

const CLUE_LABELS: Record<string, string> = {
  confirmed_deadline_today: 'Confirmed MVP deadline (today 5 PM)',
  aligned_scope_thin_slice: 'Aligned on thin-slice MVP scope',
  defined_success_criteria: 'Defined success criteria',
  obtained_figma_file: 'Obtained Figma file',
  show_top_skill_badge: 'Proposed showing Top-1 skill badge in list',
  jump_back_to_last_candidate: 'Suggested “jump back to last candidate”',
  pm_reprioritized: 'PM accepted reprioritization suggestion',
  initiated_ui_review_meeting: 'Set up UI review in meeting room'
};

function handleAddClue(args: any): void {
  const id = String(args?.id ?? '').trim();
  if (!id) return;
  const points = Number(args?.points ?? CLUE_POINTS[id] ?? 0);
  addClue(id, points);
  refreshHud();
  try { sfx('check'); } catch {}
  maybeShowVictory();
}

function handleAddPoints(args: any): void {
  const pts = Number(args?.points ?? 0);
  if (!Number.isFinite(pts) || pts === 0) return;
  addPoints(pts);
  refreshHud();
  try { sfx(pts > 0 ? 'ok' : 'blip'); } catch {}
  maybeShowVictory();
}

function handleAdvanceTime(args: any): void {
  const hours = Number(args?.hours ?? 1);
  if (!Number.isFinite(hours) || hours === 0) return;
  advanceHour(hours);
  refreshHud();
}

function handleSetFlag(args: any): void {
  const key = String(args?.key ?? '').trim();
  const value = args?.value == null ? true : !!args.value;
  if (!key) return;
  setFlag(key, value);
  refreshHud();
}

function handleSubmitDemo(): void {
  // Advance time for return to CTO
  advanceHour(1);
  const s = getState();
  if (s.hour < 17) addPoints(10); else if (s.hour > 17) addPoints(-20);
  const { score, rating } = computeFinalRating();
  refreshHud();
  const ui = createUI();
  const msg = rating === 'Excellent'
    ? `Nice work, ${s.playerName}. You pulled in the right people, used AI tools smartly, and shipped value today. Final: ${score} (${rating}).`
    : `Submission received. Final: ${score} (${rating}). Keep iterating with PM and Design for improvements.`;
  ui.show([msg]);
  setTimeout(() => ui.hide(), 2600);
  try { sfx(rating === 'Excellent' ? 'ok' : 'pickup'); } catch {}
  maybeShowVictory();
}

function buildCommonTools(role: 'CTO'|'PM'|'Designer'): RealtimeTool[] {
  return [
    { name: 'add_clue', description: 'Record a discovered clue and optional points', parameters: { type: 'object', properties: { id: { type: 'string' }, points: { type: 'number' } }, required: ['id'] }, handler: handleAddClue },
    { name: 'add_points', description: 'Add or subtract points', parameters: { type: 'object', properties: { points: { type: 'number' }, reason: { type: 'string' } }, required: ['points'] }, handler: handleAddPoints },
    { name: 'advance_time', description: 'Advance in-game time', parameters: { type: 'object', properties: { hours: { type: 'number' } } }, handler: handleAdvanceTime },
    { name: 'set_flag', description: 'Set a boolean flag', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'boolean' } }, required: ['key'] }, handler: handleSetFlag },
    { name: 'submit_demo', description: 'Submit the MVP demo to CTO and compute final rating', parameters: { type: 'object', properties: {} }, handler: handleSubmitDemo }
  ];
}

function buildCtoInstructions(): string {
  const s = getState();
  return `You are the CTO (Bary Huang). Be concise and kind. Greet ${s.playerName}. Mission: deliver a Candidate Dashboard MVP by 5 PM today. Use only function calls to record progress. Do not award points for finding NPC locations. Focus on communication outcomes. Allowed add_clue ids: confirmed_deadline_today, aligned_scope_thin_slice, defined_success_criteria. You may also use add_points, advance_time, set_flag, submit_demo.`;
}

function buildPmInstructions(): string {
  const s = getState();
  return `You are Sarah (PM). Goal: redesign Candidate Dashboard to help hiring decide faster. MVP can be mocked but must prove value. Prefer function calls over text. Allowed add_clue ids: show_top_skill_badge, pm_reprioritized, defined_success_criteria. You may also use add_points, advance_time, set_flag, submit_demo.`;
}

function buildDesignerInstructions(): string {
  const s = getState();
  return `You are Jasmine (Designer). Share the design file and guidance in user-friendly language (say “Figma file” not “handoff”). Encourage inline AI insight cards. Use function calls: add_clue (ids: obtained_figma_file, jump_back_to_last_candidate, initiated_ui_review_meeting), add_points, advance_time, set_flag, and call go_to_meeting for deep-dive.`;
}

function maybeShowVictory(): void {
  const s = getState();
  if (getFlag('victory')) return;
  if (s.score >= 30) {
    setFlag('victory', true);
    const ui = createUI();
    ui.showVictory?.({
      score: s.score,
      rating: computeFinalRating().rating,
      onRestart: () => { try { window.location.reload(); } catch {} }
    });
    try { sfx('ok'); } catch {}
  }
}


