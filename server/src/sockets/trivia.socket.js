import TriviaSession from "../models/TriviaSession.js";
import Question from "../models/Question.js";
import generateSessionId from "../utils/generateSessionId.js";
import { evaluateAnswerGroq } from "../utils/evaluateAnswerGroq.js";

export default function triviaSocket(socket, io) {
  /**
   * START SESSION
   */
  socket.on("start-session", async () => {
    const sessionId = generateSessionId();

    const questions = await Question.aggregate([
      { $sample: { size: 10 } },
      { $project: { answer: 0 } }, // hide answer
    ]);

    const session = await TriviaSession.create({
      sessionId,
      questions: questions.map((q) => ({
        questionId: q._id,
      })),
    });

    socket.join(sessionId);

    socket.emit("session-started", {
      sessionId,
      question: questions[0],
    });
  });

  /**
   * SUBMIT ANSWER
   */
  // socket.on("submit-answer", async ({ sessionId, questionId, answer }) => {
  //   const session = await TriviaSession.findOne({ sessionId });
  //   const question = await Question.findById(questionId);

  //   if (!session || !question) return;

  //   const { isCorrect, assistantResponse } = await evaluateAnswerGroq(
  //     question.question,
  //     question.answer,
  //     answer,
  //   );

  //   const qAttempt = session.questions.find(
  //     (q) => q.questionId.toString() === questionId,
  //   );

  //   qAttempt.userAnswer = answer;
  //   qAttempt.isCorrect = isCorrect;
  //   qAttempt.answeredAt = new Date();
  //   if (isCorrect) session.score += 1;

  //   await session.save();

  //   socket.emit("answer-result", {
  //     correct: isCorrect,
  //     correctAnswer: isCorrect ? null : question.answer,
  //     assistantResponse: assistantResponse,
  //   });
  // });

  socket.on("submit-answer", async ({ sessionId, questionId, answer }) => {
    const session = await TriviaSession.findOne({ sessionId });
    const question = await Question.findById(questionId);

    if (!session || !question) return;

    // 1️⃣ Evaluate the answer via Groq LLM
    const { isCorrect, assistantResponse } = await evaluateAnswerGroq(
      question.question,
      question.answer,
      answer,
    );

    // 2️⃣ Update the question attempt in session
    const qAttempt = session.questions.find(
      (q) => q.questionId.toString() === questionId,
    );

    if (qAttempt) {
      qAttempt.userAnswer = answer;
      qAttempt.isCorrect = isCorrect;
      qAttempt.answeredAt = new Date();
    }

    if (isCorrect) session.score += 1;

    // Increment current question index
    session.currentQuestionIndex += 1;

    // Check if quiz is finished
    const totalQuestions = session.questions.length; // or fixed total
    if (session.currentQuestionIndex >= totalQuestions) {
      session.status = "completed";
      session.endedAt = new Date();
      await session.save();

      socket.emit("answer-result", {
        correct: isCorrect,
        correctAnswer: isCorrect ? null : question.answer,
        assistantResponse,
      });

      socket.emit("session-ended", { score: session.score });
      return;
    }

    // 5️⃣ Fetch next question attempt from session
    const nextQAttempt = session.questions[session.currentQuestionIndex];
    const nextQuestion = await Question.findById(nextQAttempt.questionId);

    await session.save();

    // 6️⃣ Emit updates
    socket.emit("answer-result", {
      correct: isCorrect,
      correctAnswer: isCorrect ? null : question.answer,
      assistantResponse,
    });
    console.log("session.score", session.score);
    socket.emit("score-update", { score: session.score });
    socket.emit("next-question", { question: nextQuestion });
  });

  /**
   * GET HINT
   */
  socket.on("request-hint", async ({ sessionId, questionId }) => {
    const session = await TriviaSession.findOne({ sessionId });
    const question = await Question.findById(questionId);

    if (!session || !question) return;

    const qAttempt = session.questions.find(
      (q) => q.questionId.toString() === questionId,
    );

    if (qAttempt.hintsUsed >= 2) return;

    const hint = question.hints[qAttempt.hintsUsed].hintText;
    qAttempt.hintsUsed += 1;

    await session.save();
    socket.emit("hint", hint);
  });
}
