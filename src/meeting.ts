import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { fadeIn, fadeToScene } from './transition';

export function createDesignerMeetingScene(): Phaser.Scene {
  const scene = new Phaser.Scene('DesignerMeeting');
  let ui!: DialogHandle;
  let backKey!: Phaser.Input.Keyboard.Key;

  const imgUrl = new URL('./assets/meeting_with_designer.png', import.meta.url).toString();

  ;(scene as any).preload = () => {
    scene.load.image('meeting_designer', imgUrl);
  };

  ;(scene as any).create = () => {
    ui = createUI();
    backKey = scene.input.keyboard!.addKey('E');

    const tex = scene.textures.get('meeting_designer').getSourceImage() as HTMLImageElement;
    const vw = scene.scale.width;
    const vh = scene.scale.height;
    const scale = vh / tex.height; // Fit height fully
    const img = scene.add.image(vw / 2, vh / 2, 'meeting_designer')
      .setOrigin(0.5, 0.5)
      .setDepth(-1000)
      .setScale(scale)
      .setScrollFactor(0);
    scene.cameras.main.setBounds(0, 0, vw, vh);

    fadeIn(scene, { duration: 420 });
  };

  ;(scene as any).update = () => {
    if (backKey?.isDown) {
      ui.hide();
      fadeToScene(scene, 'Office', { duration: 420 });
    }
  };

  return scene;
}


