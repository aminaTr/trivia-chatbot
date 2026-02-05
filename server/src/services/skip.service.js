// Skip logic
import TriviaSession from "../models/TriviaSession.js";
import Question from "../models/Question.js";

export async function skipQuestion({ sessionId, questionId }) {
  const session = await TriviaSession.findOne({ sessionId });
  if (!session) throw new Error("Session not found");
  console.log("questionId", questionId);
  const qAttempt = session.questions.find(
    (q) =>
      q.questionId._id?.toString() === questionId.toString() ||
      q.questionId.toString() === questionId.toString(),
  );

  if (!qAttempt) {
    throw new Error("Question attempt not found");
  }

  // 🚫 Already skipped
  if (qAttempt.skipped) {
    return { skipped: false, reason: "ALREADY_SKIPPED" };
  }

  // ✅ Mark skipped
  qAttempt.skipped = true;
  qAttempt.answeredAt = new Date();

  if (session.skips <= 0) {
    return { skipped: false, reason: "NO_SKIPS_LEFT" };
  }
  // Increment session skip count
  session.skips -= 1;
  session.currentQuestionIndex += 1;

  // Fetch question for history logging
  const question = await Question.findById(questionId);
  const nextQAttempt = session.questions[session.currentQuestionIndex];
  const nextQuestion = await Question.findById(nextQAttempt.questionId);

  session.history.push({
    questionId,
    question: question?.question || "",
    correctAnswer: question?.answer || "",
    userAnswer: null,
    assistantResponse: "Question skipped.",
    action: "SKIP",
  });

  await session.save();

  return {
    skipped: true,
    skipsUsed: session.skips,
    nextQuestion,
  };
}

export async function canSkip({ sessionId, questionId }) {
  const session = await TriviaSession.findOne({ sessionId });
  if (!session) throw new Error("Session not found");

  const qAttempt = session.questions.find(
    (q) =>
      q.questionId._id?.toString() === questionId.toString() ||
      q.questionId.toString() === questionId.toString(),
  );

  if (!qAttempt) {
    return { canSkip: false };
  }

  if (qAttempt.skipped) {
    return { canSkip: false };
  }

  return { canSkip: true };
}
