import Phaser from 'phaser';

export type TaskListHandle = {
  setTasks: (lines: string[]) => void;
  setDone: (idx: number, done: boolean) => void;
  setVisible: (v: boolean) => void;
  destroy: () => void;
};

export function createTaskList(scene: Phaser.Scene, options?: { x?: number; y?: number; scale?: number }): TaskListHandle {
  const tex = scene.textures.get('task_list').getSourceImage() as HTMLImageElement;
  const board = scene.add.image(options?.x ?? 12, options?.y ?? 92, 'task_list')
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(9997)
    .setScale(options?.scale ?? 0.36)
    .setAlpha(0.97);

  // Proportional anchors within the image for three task lines and checkboxes
  const w = tex.width;
  const h = tex.height;
  // Fine‑tuned anchors to match the printed boxes/lines in the art
  const lineXs = w * 0.445; // start of text line
  const boxXs = w * 0.405;  // center of checkbox
  // Reduce vertical spacing slightly
  const ys = [h * 0.355, h * 0.515, h * 0.675];

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: '18px',
    color: '#5a3a22',
    fontStyle: 'bold',
    stroke: '#2b1a10',
    strokeThickness: 2
  };

  const offs = [10, 1, 0];

  const texts = ys.map((y, i) => scene.add.text(board.x + lineXs * board.scaleX, board.y + y * board.scaleY + offs[i], '', style)
    .setScrollFactor(0)
    .setDepth(9999)
    .setOrigin(0, 0.5));

  const checks = ys.map((y, i) => scene.add.text(board.x + boxXs * board.scaleX, board.y + y * board.scaleY + offs[i], '', {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: '28px', color: '#c49a2a',
    stroke: '#7a5a15',
    strokeThickness: 4
  }).setScrollFactor(0).setDepth(9999).setOrigin(0.5));

  const relayout = () => {
    texts.forEach((t, i) => {
      t.setPosition(board.x + lineXs * board.scaleX, board.y + ys[i] * board.scaleY + offs[i]);
    });
    checks.forEach((c, i) => {
      c.setPosition(board.x + boxXs * board.scaleX, board.y + ys[i] * board.scaleY + offs[i]);
    });
  };

  const setTasks = (lines: string[]) => {
    for (let i = 0; i < texts.length; i++) {
      texts[i].setText(lines[i] ?? '');
    }
  };

  const setDone = (idx: number, done: boolean) => {
    if (!checks[idx]) return;
    checks[idx].setText(done ? '✔' : '');
  };

  const setVisible = (v: boolean) => {
    board.setVisible(v);
    texts.forEach(t => t.setVisible(v));
    checks.forEach(c => c.setVisible(v));
  };

  const destroy = () => {
    board.destroy();
    texts.forEach(t => t.destroy());
    checks.forEach(c => c.destroy());
  };

  // Listen to resize to keep at the same screen position
  scene.scale.on('resize', () => relayout());

  return { setTasks, setDone, setVisible, destroy };
}


