import Phaser from 'phaser';
import { createLobbyScene, createMeetingScene, createEngineeringScene, createLoungeScene, createLabScene } from './scenes_side';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e1014',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [
    createLobbyScene(),
    createMeetingScene(),
    createEngineeringScene(),
    createLoungeScene(),
    createLabScene()
  ]
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);


