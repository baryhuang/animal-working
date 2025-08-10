import Phaser from 'phaser';
import { createUI, DialogHandle } from './ui';
import { fadeIn, fadeToScene } from './transition';
import { getState, advanceHour } from './state';
import { startOpenAiVoiceSession, VoiceSession, RealtimeTool } from './realtime';
import { realtimeSessionManager } from './realtimeManager';

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

    // Auto start designer voice in meeting; add a tool to go back to office when user says it's clear/done
    if (!isConnecting && !voice && openAiKey) {
      isConnecting = true;
      const tools: RealtimeTool[] = [
        {
          name: 'go_back_to_office',
          description: 'Call when the user says they are clear/done to return to the office',
          parameters: { type: 'object', properties: { reason: { type: 'string' } } },
          handler: () => fadeToScene(scene, 'Office', { duration: 420, onBeforeStart: () => { advanceHour(1); const ui2 = createUI(); const s = getState(); ui2.setClues?.(Array.from(s.clues), s.score, s.hour); } })
        }
      ];
      realtimeSessionManager.ensureSingle('designer_meeting', {
        apiKey: openAiKey,
        instructions: 'You are Jasmine as Designer. On your first message, continue the conversation with: "Hi Andy, what do you need help with?" We are in the meeting room—help the user clarify design and call go_back_to_office when they say they are clear.',
        model: 'gpt-4o-realtime-preview',
        voice: 'coral',
        tools
      }).then(v => { voice = v; const s = getState(); voice.say(`Hi ${s.playerName}, I'm Jasmine, your Designer.`); voice.say("Let's begin. We'll check information hierarchy, contrast, and spacing. Interrupt me anytime."); })
       .catch(() => {/* ignore */})
       .finally(() => { isConnecting = false; });
    }
  };

  ;(scene as any).update = () => {
    if (backKey?.isDown) {
      ui.hide();
      try { voice?.stop(); } catch {}
      voice = null;
      fadeToScene(scene, 'Office', { duration: 420 });
    }
  };

  ;(scene as any).shutdown = () => { try { voice?.stop(); } catch {} voice = null; };
  ;(scene as any).destroy = () => { try { voice?.stop(); } catch {} voice = null; };

  return scene;
}


