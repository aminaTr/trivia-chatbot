import TriviaSession from "../models/TriviaSession.js";

export async function getSummary(sessionId) {
  const session = await TriviaSession.findOne({ sessionId }).populate(
    "questions.questionId",
  ); // Populate to get question text

  if (!session) {
    throw new Error("Session not found"); // Don't return res here
  }
  const answeredOrSkippedQuestions = session.questions
    .filter((q) => q.userAnswer || q.skipped)
    .map((q) => ({
      question: q.questionId?.text || q.questionId?.question,
      userAnswer: q.userAnswer,
      // correctAnswer: q.questionId?.correctAnswer,
      isCorrect: q.isCorrect,
      hintsUsed: q.hintsUsed,
      skipped: q.skipped,
    }));

  const summary = {
    score: session.score,
    correctAnswers: session.questions.filter((q) => q.isCorrect).length,
    difficulty: session.difficulty,
    category: session.category,
    questions: answeredOrSkippedQuestions,
    totalQuestions: answeredOrSkippedQuestions.filter((q) => !q.skipped).length,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };

  return summary;
}
