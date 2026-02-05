import TriviaSession from "../models/TriviaSession.js";
import Question from "../models/Question.js";
import generateSessionId from "../utils/generateSessionId.js";

export async function startTriviaSession({
  questionCount = 10,
  skip = 2,
  difficulty,
  category,
}) {
  // 1. Generate session ID
  const sessionId = generateSessionId();

  const questions = await Question.aggregate([
    {
      $match: {
        ...(difficulty && { difficulty: difficulty }),
        ...(category && { category: category }),
      },
    },
    { $sample: { size: questionCount } },
    { $project: { answer: 0 } }, // hide answer
  ]);

  if (!questions.length) {
    throw new Error("No questions available");
  }

  // 3. Persist session
  const session = await TriviaSession.create({
    sessionId,
    currentIndex: 0,
    questions: questions.map((q) => ({
      questionId: q._id,
    })),
    history: [],
    skips: skip,
  });

  return {
    sessionId,
    firstQuestion: questions[0],
    questions,
  };
}

export async function getSession({ sessionId }) {
  const session = await TriviaSession.findOne({ sessionId })
    .populate({
      path: "questions.questionId",
      select: "-__v",
      options: { lean: true },
    })
    .lean();

  return session;
}

export async function stopTriviaEarly({ sessionId }) {
  try {
    console.log(sessionId);
    const session = await TriviaSession.findOne({ sessionId });
    if (!session) return false;
    session.status = "abandoned";
    session.endedAt = new Date();
    await session.save();
    return true;
  } catch {
    console.error("Failed to stop session:", err);

    return false;
  }
}
