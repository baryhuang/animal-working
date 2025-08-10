import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { fadeIn, fadeToScene } from './transition';
import { startOpenAiVoiceSession, VoiceSession, RealtimeTool } from './realtime';

export function createDesignerMeetingScene(): Phaser.Scene {
  const scene = new Phaser.Scene('DesignerMeeting');
  let ui!: DialogHandle;
  let backKey!: Phaser.Input.Keyboard.Key;
  let voice: VoiceSession | null = null;
  let isConnecting = false;
  let openAiKey: string | null =
    ((import.meta as any)?.env?.VITE_OPENAI_API_KEY as string | undefined) ??
    (localStorage.getItem('oaiKey') as string | null) ??
    ((window as any).OPENAI_API_KEY as string | null) ??
    null;

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

    openAiKey = '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';

    // Auto start designer voice in meeting; add a tool to go back to office when user says完成/清楚了
    if (!isConnecting && !voice && openAiKey) {
      isConnecting = true;
      const tools: RealtimeTool[] = [
        {
          name: 'go_back_to_office',
          description: '当用户表示“明白了/清楚了/可以结束”时调用，返回办公室场景',
          parameters: { type: 'object', properties: { reason: { type: 'string' } } },
          handler: () => fadeToScene(scene, 'Office', { duration: 420 })
        }
      ];
      startOpenAiVoiceSession(
        openAiKey,
        '你是一名女性设计师。现在我们在会议室里，帮助用户梳理设计问题并给出建议。如果用户表示已经清楚/明白/可以回去，请调用 go_back_to_office 工具。',
        'gpt-4o-realtime-preview',
        'verse',
        tools
      ).then(v => { voice = v; voice.say('我们开始吧。我会先确认信息层级、对比与留白，你也可以随时打断我。'); })
       .catch(() => {/* ignore */})
       .finally(() => { isConnecting = false; });
    }
  };

  ;(scene as any).update = () => {
    if (backKey?.isDown) {
      ui.hide();
      fadeToScene(scene, 'Office', { duration: 420 });
    }
  };

  ;(scene as any).shutdown = () => { voice?.stop(); voice = null; };
  ;(scene as any).destroy = () => { voice?.stop(); voice = null; };

  return scene;
}


