import Phaser from 'phaser';
import { createHubScene, createLeadershipScene, createCultureScene, createProductScene, createNetworkScene, createGateScene } from './scenes';

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
  scene: [createGateScene(), createHubScene(), createLeadershipScene(), createCultureScene(), createProductScene(), createNetworkScene()]
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);


