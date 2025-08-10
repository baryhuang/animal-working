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

  // Subtle idle bobbing
  const amp = cfg.bob?.amplitude ?? 1;
  const dur = cfg.bob?.durationMs ?? 1800;
  scene.tweens.add({ targets: sprite, y: cfg.y + amp, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
    speakTimer = scene.time.addEvent({
      delay: Phaser.Math.Between(300, 500),
      loop: true,
      callback: () => {
        speakingOn = !speakingOn;
        sprite.setFrame(speakingOn ? cfg.speakFrame : cfg.idleFrame);
      }
    });
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
    sprite.destroy();
  };

  return { sprite, startSpeaking, stopSpeaking, destroy };
}


