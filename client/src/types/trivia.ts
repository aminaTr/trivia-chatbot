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
}

export interface AnswerResult {
  correct: boolean;
  score: number;
  assistantResponse: string;
}
