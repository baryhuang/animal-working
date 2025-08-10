import Phaser from 'phaser';
import { createSideScene } from './side';
import { addTaskCompleted, getProgress, markMentorFound } from './state';

export function createLobbyScene(): Phaser.Scene {
  return createSideScene({
    name: 'Lobby',
    banner: 'Company Lobby · HR Welcome',
    spawnX: 200,
    width: 2000,
    doors: [
      { x: 400, label: 'Engineering', target: 'Engineering', isLocked: () => ({ locked: getProgress().tasksCompleted < 1, reason: 'Complete HR task first' }) },
      { x: 800, label: 'Meeting', target: 'Meeting' },
      { x: 1200, label: 'Lounge', target: 'Lounge' },
      { x: 1600, label: 'Lab', target: 'Lab', isLocked: () => ({ locked: getProgress().tasksCompleted < 2, reason: 'Unlocks after completing 2 tasks' }) }
    ],
    npcs: [
      {
        x: 260,
        name: 'HR',
        onInteract: async (_scene, ui) => {
          ui.show(['Welcome aboard!', 'Today’s goal: find your mentor + complete 3 tasks']);
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
    banner: 'Meeting Room · Leadership Principles Discussion',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: 'Back to Lobby', target: 'Lobby' } ],
    npcs: [
      {
        x: 600,
        name: 'Mentor',
        onInteract: async (_scene, ui) => {
          ui.show(['Mentor: Welcome. The core of "Customer Obsession" is to work backwards from the customer to do the right thing.']);
          addTaskCompleted();
          setTimeout(() => ui.hide(), 1200);
        }
      }
    ]
  });
}

export function createEngineeringScene(): Phaser.Scene {
  return createSideScene({
    name: 'Engineering',
    banner: 'Engineering · Fix the server to unlock',
    spawnX: 200,
    width: 1800,
    doors: [ { x: 1700, label: 'Back to Lobby', target: 'Lobby' } ],
    npcs: [
      {
        x: 900,
        name: 'SRE',
        lines: ['The server fan is loose. Press E twice to “tighten” it (simulated).']
      },
      {
        x: 1000,
        name: 'Server Rack',
        onInteract: async (_scene, ui) => {
          ui.show(['You tightened two screws... done!']);
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
    banner: 'Lounge · Team Culture',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: 'Back to Lobby', target: 'Lobby' } ],
    npcs: [
      {
        x: 800,
        name: 'Colleague',
        lines: ['We emphasize candid communication and fast action—welcome aboard!']
      }
    ]
  });
}

export function createLabScene(): Phaser.Scene {
  return createSideScene({
    name: 'Lab',
    banner: 'Lab · Simulated Release',
    spawnX: 200,
    width: 1600,
    doors: [ { x: 1500, label: 'Back to Lobby', target: 'Lobby' } ],
    npcs: [
      {
        x: 900,
        name: 'Release Bot',
        onInteract: async (_scene, ui) => {
          const p = getProgress();
          const passed = p.tasksCompleted >= 3;
          ui.show([
            passed ? 'Checks passed: you completed the onboarding key tasks—welcome to the team!' : 'Requirements not met: complete 3 tasks first and try again',
          ]);
          setTimeout(() => ui.hide(), 1400);
        }
      }
    ]
  });
}


