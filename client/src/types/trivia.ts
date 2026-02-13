export interface Hint {
  hintText: string;
  order: number;
}

export interface Question {
  _id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  hints: Hint[];
  qNum?: string;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  assistantResponse: string;
}
