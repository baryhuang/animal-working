// Minimal OpenAI Realtime WebRTC helper for Electron/Web
// NOTE: For development only. Reads API key from caller; do not ship with hardcoded secrets.

export type VoiceSession = {
  stop: () => void;
  isActive: () => boolean;
  say: (text: string) => void;
};

export type RealtimeTool = {
  name: string;
  description: string;
  // JSON schema-like parameters object
  parameters: any;
  handler: (args: any) => void;
};

export async function startOpenAiVoiceSession(
  apiKey: string,
  instructions = 'You are a friendly CTO. Talk concisely.',
  model = 'gpt-4o-realtime-preview',
  voice = 'onyx',
  tools: RealtimeTool[] = []
): Promise<VoiceSession> {
  const pc = new RTCPeerConnection();
  let closed = false;

  console.log('startOpenAiVoiceSession', apiKey, instructions, model, voice);

  // Remote audio sink
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  (audioEl as any).playsInline = true;
  audioEl.style.display = 'none';
  document.body.appendChild(audioEl);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    audioEl.srcObject = stream;
    audioEl.play().then(() => console.log('[realtime] remote audio playing')).catch((e) => console.warn('[realtime] play failed', e));
  };

  // Mic capture
  const media = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
    console.error('[realtime] mic error', err);
    throw err;
  });
  media.getTracks().forEach(t => pc.addTrack(t, media));
  // Ensure we also negotiate a recvonly audio track for assistant speech
  pc.addTransceiver('audio', { direction: 'recvonly' });

  // Data channel for events
  const dc = pc.createDataChannel('oai-events');
  let dcReady = false;
  const sayQueue: string[] = [];

  // Create SDP offer
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const base = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`;
  const resp = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Beta': 'realtime=v1'
    },
    body: offer.sdp || ''
  });
  const answerSdp = await resp.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  dc.onopen = () => {
    dcReady = true;
    // Kick off an initial response loop so the assistant speaks when hearing the user
    try {
      const sessionUpdate: any = {
        type: 'session.update',
        session: { instructions, turn_detection: { type: 'server_vad' } }
      };
      if (tools.length) {
        sessionUpdate.session.tools = tools.map(t => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.parameters ?? { type: 'object', properties: {} }
        }));
      }
      dc.send(JSON.stringify(sessionUpdate));
      dc.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio'], instructions: '你好，我是 CTO，很高兴见到你。现在我们已经连上麦克风了，你可以直接说话。' }
      }));
      // Flush queued says
      while (sayQueue.length) {
        const txt = sayQueue.shift()!;
        dc.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio'], instructions: txt } }));
      }
    } catch {}
  };

  // Tool call handler
  const toolMap: Record<string, RealtimeTool> = Object.fromEntries(tools.map(t => [t.name, t]));
  dc.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      // Realtime function/tool call variants
      const name = data?.name || data?.tool?.name || data?.response?.tool?.name || data?.function_call?.name;
      const args = data?.arguments || data?.tool?.arguments || data?.response?.tool?.arguments || data?.function_call?.arguments;
      if (name && toolMap[name]) {
        let parsed: any = args;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        toolMap[name].handler(parsed);
      }
    } catch {}
  };

  const stop = () => {
    if (closed) return;
    closed = true;
    try { dc.close(); } catch {}
    try { pc.close(); } catch {}
    media.getTracks().forEach(t => t.stop());
    if (audioEl.srcObject) {
      const s = audioEl.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
    }
    audioEl.remove();
  };

  const say = (text: string) => {
    if (closed) return;
    const payload = { type: 'response.create', response: { modalities: ['audio'], instructions: text } };
    try { dcReady ? dc.send(JSON.stringify(payload)) : sayQueue.push(text); } catch {}
  };

  return { stop, isActive: () => !closed, say };
}


