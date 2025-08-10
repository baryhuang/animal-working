export type GameState = {
  playerName: string;
  companyName: string;
  roleTitle: string;
  hour: number; // 9..24
  score: number;
  clues: Set<string>;
  flags: Record<string, boolean>;
  toolbar: { cursor: boolean; gpt5: boolean; claude: boolean };
};

const state: GameState = {
  playerName: 'Intern',
  companyName: 'Peak Mojo',
  roleTitle: 'Engineer Intern',
  hour: 9,
  score: 0,
  clues: new Set<string>(),
  flags: {},
  toolbar: { cursor: false, gpt5: false, claude: false }
};

export function getState(): GameState { return state; }

export function setPlayerProfile(name: string, company: string, role: string): void {
  state.playerName = name || 'Intern';
  state.companyName = company || 'Peak Mojo';
  state.roleTitle = role || 'Engineer Intern';
}

export function addPoints(points: number): void { state.score += points; }

export function addClue(id: string, points = 0): void {
  if (!state.clues.has(id)) {
    state.clues.add(id);
    state.score += points;
  }
}

export function hasClue(id: string): boolean { return state.clues.has(id); }

export function setFlag(key: string, val = true): void { state.flags[key] = val; }
export function getFlag(key: string): boolean { return !!state.flags[key]; }

export function advanceHour(hours = 1): void { state.hour += hours; }

export function shouldUnlockToolbar(): boolean { return state.clues.size >= 6; }

export function markToolbarClick(kind: 'cursor'|'gpt5'|'claude'): void {
  (state.toolbar as any)[kind] = true;
}

export function computeFinalRating(): { score: number; rating: 'Excellent'|'Pass'|'Fail' } {
  const s = state.score;
  const rating = s >= 80 ? 'Excellent' : s >= 60 ? 'Pass' : 'Fail';
  return { score: s, rating };
}

// --- Legacy shims for older scenes_side.ts ---
type LegacyProgress = { mentorFound: boolean; tasksCompleted: number; quizScores: Record<string, number> };
const legacy: LegacyProgress = { mentorFound: false, tasksCompleted: 0, quizScores: {} };

export function getProgress(): LegacyProgress { return legacy; }
export function markMentorFound(): void { legacy.mentorFound = true; setFlag('mentorFound', true); }
export function addTaskCompleted(): void { legacy.tasksCompleted += 1; }
export function setQuizScore(id: string, score: number): void { legacy.quizScores[id] = score; }


