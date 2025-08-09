export type Progress = {
  mentorFound: boolean;
  tasksCompleted: number;
  quizScores: Record<string, number>;
};

const state: Progress = {
  mentorFound: false,
  tasksCompleted: 0,
  quizScores: {}
};

export function getProgress(): Progress {
  return state;
}

export function markMentorFound(): void {
  state.mentorFound = true;
}

export function addTaskCompleted(): void {
  state.tasksCompleted += 1;
}

export function setQuizScore(id: string, score: number): void {
  state.quizScores[id] = score;
}


