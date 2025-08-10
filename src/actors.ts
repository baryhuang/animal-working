import Phaser from 'phaser';

export type SimpleNpcConfig = {
  x: number;
  y: number;
  sheetKey: string; // spritesheet key already added to textures
  idleFrame: number; // default idle frame index
  speakFrame: number; // talking frame index
  blinkFrame?: number; // optional blink/adjust frame index
  depthByY?: boolean; // default true
  bob?: { amplitude?: number; durationMs?: number };
  perspective?: { worldHeight: number; min?: number; max?: number };
  speakMode?: 'toggle' | 'hold'; // default 'toggle'
};

export type SimpleNpc = {
  sprite: Phaser.GameObjects.Sprite;
  startSpeaking: () => void;
  stopSpeaking: () => void;
  destroy: () => void;
};

function computePerspectiveScale(y: number, worldHeight: number, min = 0.18, max = 0.56): number {
  const t = Phaser.Math.Clamp(y / worldHeight, 0, 1);
  return min + (max - min) * t;
}

export function createSimpleNpc(scene: Phaser.Scene, cfg: SimpleNpcConfig): SimpleNpc {
  const depthByY = cfg.depthByY ?? true;
  const sprite = scene.add.sprite(cfg.x, cfg.y, cfg.sheetKey, cfg.idleFrame)
    .setOrigin(0.5, 1)
    .setDepth(depthByY ? cfg.y : 0);

  if (cfg.perspective) {
    const s = computePerspectiveScale(cfg.y, cfg.perspective.worldHeight, cfg.perspective.min, cfg.perspective.max);
    sprite.setScale(s);
  }

  // Subtle idle motion: small sinusoidal bob + breathing drift (no conflicting tweens)
  const baseY = cfg.y;
  const bobAmp = cfg.bob?.amplitude ?? 0.25;
  const breathAmp = 0.20; // match (and slightly lower than) player
  const bobSpeed = (cfg.bob?.durationMs ?? 1800) > 0 ? (Math.PI * 2) / (cfg.bob?.durationMs ?? 1800) : 0.003;
  const phase = Math.random() * Math.PI * 2;
  const onUpdate = () => {
    const time = scene.time.now;
    const y = baseY + Math.sin(time * bobSpeed + phase) * bobAmp + Math.sin(time * 0.006 + phase * 0.7) * breathAmp;
    sprite.setY(y);
    if (cfg.depthByY ?? true) sprite.setDepth(y);
  };
  scene.events.on('update', onUpdate);

  // Random blink/adjust
  let blinkTimer: Phaser.Time.TimerEvent | null = null;
  const scheduleBlink = () => {
    if (cfg.blinkFrame == null) return;
    const delay = Phaser.Math.Between(3000, 5000);
    blinkTimer = scene.time.delayedCall(delay, () => {
      sprite.setFrame(cfg.blinkFrame!);
      scene.time.delayedCall(220, () => sprite.setFrame(cfg.idleFrame));
      scheduleBlink();
    });
  };
  scheduleBlink();

  // Speaking toggle
  let speakTimer: Phaser.Time.TimerEvent | null = null;
  let speakingOn = false;
  const startSpeaking = () => {
    if (speakTimer) return;
    speakingOn = true;
    sprite.setFrame(cfg.speakFrame);
    if ((cfg.speakMode ?? 'toggle') === 'toggle') {
      speakTimer = scene.time.addEvent({
        delay: Phaser.Math.Between(300, 500),
        loop: true,
        callback: () => {
          speakingOn = !speakingOn;
          sprite.setFrame(speakingOn ? cfg.speakFrame : cfg.idleFrame);
        }
      });
    }
  };
  const stopSpeaking = () => {
    if (speakTimer) {
      speakTimer.remove(false);
      speakTimer = null;
    }
    sprite.setFrame(cfg.idleFrame);
  };

  const destroy = () => {
    speakTimer?.remove(false);
    blinkTimer?.remove(false);
    scene.events.off('update', onUpdate);
    sprite.destroy();
  };

  return { sprite, startSpeaking, stopSpeaking, destroy };
}


