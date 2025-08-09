import Phaser from 'phaser';
import { createGameScene } from './scene';

export function createHubScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Hub',
    banner: 'Company Plaza',
    spawn: { x: 1100, y: 1500 },
    exits: [
      { x: 1100, y: 1560, label: '公司大门（按 E 进入）', target: 'Gate' },
      { x: 200, y: 200, label: 'Leadership', target: 'Leadership' },
      { x: 2000, y: 200, label: 'Culture', target: 'Culture' },
      { x: 200, y: 1400, label: 'Product', target: 'Product' },
      { x: 2000, y: 1400, label: 'Network', target: 'Network' },
    ],
    npcs: [
      { x: 1100, y: 780, text: ['HR: 欢迎来到广场！', '走到招牌进入对应主题。'] }
    ]
  });
  return scene;
}

export function createGateScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Gate',
    banner: '公司门口 Entrance',
    spawn: { x: 1100, y: 1550 },
    exits: [
      { x: 1100, y: 1560, label: '进入广场（E）', target: 'Hub' }
    ],
    npcs: [
      { x: 1080, y: 1520, text: ['保安: 早上好！今天也要加油哦。'] }
    ]
  });
  return scene;
}

export function createLeadershipScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Leadership',
    banner: 'Leadership Principle Plaza',
    npcs: [
      { x: 1000, y: 760, text: ['雕像: “客户至上”的含义是什么？', 'A: 从客户倒推，做正确的事。'] },
    ],
    exits: [{ x: 60, y: 800, label: '← 返回 Hub', target: 'Hub' }]
  });
  return scene;
}

export function createCultureScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Culture',
    banner: 'Culture Garden',
    npcs: [
      { x: 1200, y: 900, text: ['漫步的同事: 今天天气不错，聊两句？'] },
    ],
    exits: [{ x: 60, y: 800, label: '← 返回 Hub', target: 'Hub' }]
  });
  return scene;
}

export function createProductScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Product',
    banner: 'Product Lab',
    npcs: [
      { x: 1000, y: 820, text: ['设备: 需要修复！按 E 启动小游戏（占位）。'] },
    ],
    exits: [{ x: 60, y: 800, label: '← 返回 Hub', target: 'Hub' }]
  });
  return scene;
}

export function createNetworkScene(): Phaser.Scene {
  const scene = createGameScene({
    name: 'Network',
    banner: 'Network Tower',
    npcs: [
      { x: 1100, y: 1000, text: ['你拾取了名片：Alex（Engineering）'] },
    ],
    exits: [{ x: 60, y: 800, label: '← 返回 Hub', target: 'Hub' }]
  });
  return scene;
}


