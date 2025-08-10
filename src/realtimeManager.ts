import { startOpenAiVoiceSession, VoiceSession, RealtimeTool } from './realtime';

type StartArgs = {
  apiKey: string;
  instructions: string;
  model?: string;
  voice?: string;
  tools?: RealtimeTool[];
};

class RealtimeSessionManager {
  private activeSessions: Map<string, VoiceSession> = new Map();
  private isStarting = false;
  private isStopping = false;
  private cooldownUntil = 0;

  canConnect(): boolean {
    return Date.now() >= this.cooldownUntil && !this.isStarting && !this.isStopping;
  }

  async ensureSingle(kind: string, args: StartArgs): Promise<VoiceSession> {
    // Prevent flapping
    if (!this.canConnect()) {
      throw new Error('connect-cooldown');
    }
    this.isStarting = true;
    try {
      await this.stopAll(400);
      const session = await startOpenAiVoiceSession(
        args.apiKey,
        args.instructions,
        args.model ?? 'gpt-4o-realtime-preview',
        args.voice ?? 'ballad',
        args.tools ?? []
      );
      this.activeSessions.set(kind, session);
      return session;
    } finally {
      this.isStarting = false;
    }
  }

  async stopAll(timeoutMs = 500): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;
    try {
      for (const [, s] of this.activeSessions) {
        try { s.stop(); } catch {}
      }
      this.activeSessions.clear();
      // brief cooldown to avoid immediate re-connect during transitions
      this.cooldownUntil = Date.now() + Math.max(300, timeoutMs);
      await new Promise(resolve => setTimeout(resolve, timeoutMs));
    } finally {
      this.isStopping = false;
    }
  }
}

export const realtimeSessionManager = new RealtimeSessionManager();


