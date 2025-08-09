import Phaser from 'phaser';
import { createSideScene } from './side';
import { addTaskCompleted, getProgress, markMentorFound, setQuizScore } from './state';

export function createLobbyScene(): Phaser.Scene {
  return createSideScene({
    name: 'Lobby',
    banner: '公司大厅 · HR 欢迎你',
    spawnX: 200,
    width: 2000,
    doors: [
      { x: 400, label: '研发区', target: 'Engineering', isLocked: () => ({ locked: getProgress().tasksCompleted < 1, reason: '先完成 HR 任务' }) },
      { x: 800, label: '会议室', target: 'Meeting' },
      { x: 1200, label: '休闲区', target: 'Lounge' },
      { x: 1600, label: '实验室', target: 'Lab', isLocked: () => ({ locked: getProgress().tasksCompleted < 2, reason: '完成 2 个任务后开放' }) }
    ],
    npcs: [
      {
        x: 260,
        name: 'HR',
        onInteract: async (_scene, ui) => {
          ui.show(['欢迎入职！', '今天你的目标：找到导师 + 完成 3 个任务']);
          await new Promise(r => setTimeout(r, 1200));
          ui.hide();
          markMentorFound();
          addTaskCompleted();
        }
      }
    ]
  });
}

export function createMeetingScene(): Phaser.Scene {
  return createSideScene({
    name: 'Meeting',
    banner: '会议室 · 领导原则问答',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: '返回大厅', target: 'Lobby' } ],
    npcs: [
      {
        x: 600,
        name: '导师',
        onInteract: async (_scene, ui) => {
          const idx = await ui.ask!('“客户至上”最准确的理解是？', [
            '快速上线功能以满足业务',
            '从客户倒推，做正确的事',
            '优先内部效率'
          ]);
          const score = idx === 1 ? 1 : 0;
          setQuizScore('leadership_q1', score);
          addTaskCompleted();
          ui.show([score ? '答对了！' : '再想想，下次会更好']);
          setTimeout(() => ui.hide(), 1200);
        }
      }
    ]
  });
}

export function createEngineeringScene(): Phaser.Scene {
  return createSideScene({
    name: 'Engineering',
    banner: '研发区 · 修好服务器解锁',
    spawnX: 200,
    width: 1800,
    doors: [ { x: 1700, label: '返回大厅', target: 'Lobby' } ],
    npcs: [
      {
        x: 900,
        name: 'SRE',
        lines: ['服务器风扇松了，帮我按 E 两次“拧紧”就好（模拟任务）']
      },
      {
        x: 1000,
        name: '机柜',
        onInteract: async (_scene, ui) => {
          ui.show(['你拧紧了两颗螺丝……完成！']);
          addTaskCompleted();
          setTimeout(() => ui.hide(), 900);
        }
      }
    ]
  });
}

export function createLoungeScene(): Phaser.Scene {
  return createSideScene({
    name: 'Lounge',
    banner: '休闲区 · 团队文化',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: '返回大厅', target: 'Lobby' } ],
    npcs: [
      {
        x: 800,
        name: '同事',
        lines: ['我们强调“坦诚沟通、快速行动”，欢迎加入！']
      }
    ]
  });
}

export function createLabScene(): Phaser.Scene {
  return createSideScene({
    name: 'Lab',
    banner: '实验室 · 模拟上线',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: '返回大厅', target: 'Lobby' } ],
    npcs: [
      {
        x: 900,
        name: 'Release Bot',
        onInteract: async (_scene, ui) => {
          const p = getProgress();
          const passed = p.tasksCompleted >= 3;
          ui.show([
            passed ? '检查通过：你已完成入职关键任务，欢迎入队！' : '条件未满足：先完成 3 个任务再试',
          ]);
          setTimeout(() => ui.hide(), 1400);
        }
      }
    ]
  });
}


