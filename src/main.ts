import Phaser from 'phaser';
import { createLobbyScene, createMeetingScene, createEngineeringScene, createLoungeScene, createLabScene } from './scenes_side';
import { createOfficeScene } from './office';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e1014',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  scene: [
    createOfficeScene(),
    createLobbyScene(),
    createMeetingScene(),
    createEngineeringScene(),
    createLoungeScene(),
    createLabScene()
  ]
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);


