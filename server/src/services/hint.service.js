// Hint logic
import TriviaSession from "../models/TriviaSession.js";
import Question from "../models/Question.js";

export async function getHint({ sessionId, questionId }) {
  const session = await TriviaSession.findOne({ sessionId });
  if (!session) throw new Error("Session not found");

  const question = await Question.findById(questionId);
  if (!question) throw new Error("Question not found");

  const qAttempt = session.questions.find(
    (q) =>
      q.questionId._id?.toString() === questionId.toString() ||
      q.questionId.toString() === questionId.toString(),
  );

  if (!qAttempt) {
    console.warn("Hint requested for non-session question", {
      sessionId,
      questionId,
    });
    return { hint: null, exhausted: true };
  }

  if (qAttempt.hintsUsed >= question.hints.length) {
    return { hint: null, exhausted: true };
  }

  const hint = question.hints[qAttempt.hintsUsed].hintText;
  qAttempt.hintsUsed += 1;

  await session.save();

  return { hint, exhausted: false };
}
export async function checkHint({ sessionId, questionId }) {
  const session = await TriviaSession.findOne({ sessionId });

  if (!session) throw new Error("Session not found");

  const question = await Question.findById(questionId);
  if (!question) throw new Error("Question not found");

  const qAttempt = session.questions.find(
    (q) =>
      q.questionId._id?.toString() === questionId.toString() ||
      q.questionId.toString() === questionId.toString(),
  );

  if (!qAttempt) {
    console.warn("Hint requested for non-session question", {
      sessionId,
      questionId,
    });
    return { hint: null, exhausted: true };
  }

  if (qAttempt.hintsUsed >= question.hints.length) {
    return { hint: null, exhausted: true };
  }

  const hint = question.hints[qAttempt.hintsUsed].hintText;

  return { hint, exhausted: false };
}
