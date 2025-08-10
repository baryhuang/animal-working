import Phaser from 'phaser';

export type TransitionOptions = {
  duration?: number;
  color?: number;
  onBeforeStart?: () => void;
};

export function fadeIn(scene: Phaser.Scene, opts: TransitionOptions = {}): Promise<void> {
  const duration = opts.duration ?? 350;
  const cam = scene.cameras.main;
  return new Promise(resolve => {
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => resolve());
    cam.fadeIn(duration, 0, 0, 0);
  });
}

export function fadeToScene(scene: Phaser.Scene, target: string, opts: TransitionOptions = {}): Promise<void> {
  const duration = opts.duration ?? 350;
  const cam = scene.cameras.main;
  return new Promise(resolve => {
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      opts.onBeforeStart?.();
      scene.scene.start(target);
      resolve();
    });
    cam.fadeOut(duration, 0, 0, 0);
  });
}


