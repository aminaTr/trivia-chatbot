// Answer validation & scoring

import TriviaSession from "../models/TriviaSession.js";
import Question from "../models/Question.js";
import { evaluateAnswerGroq } from "./ai/evaluteAnswer.service.js";

export async function submitAnswer({ sessionId, questionId, answer }) {
  const session = await TriviaSession.findOne({ sessionId });
  if (!session) throw new Error("Session not found");

  const question = await Question.findById(questionId);
  if (!question) throw new Error("Question not found");

  // 1. LLM evaluation
  const { isCorrect, assistantResponse } = await evaluateAnswerGroq(
    question.question,
    question.answer,
    answer,
    session.history ?? [],
  );

  // 2. Update attempt
  const qAttempt = session.questions.find(
    (q) =>
      q.questionId._id?.toString() === questionId.toString() ||
      q.questionId.toString() === questionId.toString(),
  );

  if (!qAttempt) throw new Error("Question attempt not found");

  qAttempt.userAnswer = answer;
  qAttempt.isCorrect = isCorrect;
  qAttempt.answeredAt = new Date();

  if (isCorrect) {
    session.score += 1;
    //  persist interaction AFTER decision
    session.history.push({
      questionId,
      question: question.question,
      correctAnswer: question.answer,
      userAnswer: answer,
      assistantResponse: assistantResponse,
      action: "ANSWER",
    });
  }

  session.currentQuestionIndex += 1;

  const totalQuestions = session.questions.length;

  const skipCount = session.questions.filter((q) => q.skipped).length;

  const answeredCount = session.questions.filter(
    (q) => q.userAnswer && !q.skipped,
  ).length;

  const effectiveTotal = totalQuestions - skipCount;
  let isCompleted = false;
  let nextQuestion = null;

  if (answeredCount >= effectiveTotal) {
    session.status = "completed";
    session.endedAt = new Date();
    isCompleted = true;
  } else {
    const nextQAttempt = session.questions[session.currentQuestionIndex];
    nextQuestion = await Question.findById(nextQAttempt.questionId).lean();
    nextQuestion = {
      ...nextQuestion,
      qNum: session.currentQuestionIndex + 1,
    };
  }

  await session.save();

  return {
    isCorrect,
    assistantResponse,
    correctAnswer: question.answer,
    score: session.score,
    isCompleted,
    nextQuestion,
  };
}

// // Answer validation & scoring

// import TriviaSession from "../models/TriviaSession.js";
// import Question from "../models/Question.js";
// import { evaluateAnswerGroq } from "./ai/evaluteAnswer.service.js";

// export async function submitAnswer({ sessionId, questionId, answer }) {
//   const session = await TriviaSession.findOne({ sessionId });
//   if (!session) throw new Error("Session not found");

//   const question = await Question.findById(questionId);
//   if (!question) throw new Error("Question not found");

//   // 1. LLM evaluation
//   const { isCorrect, assistantResponse } = await evaluateAnswerGroq(
//     question.question,
//     question.answer,
//     answer,
//     session.history ?? [],
//   );

//   // 2. Update attempt
//   const qAttempt = session.questions.find(
//     (q) =>
//       q.questionId._id?.toString() === questionId.toString() ||
//       q.questionId.toString() === questionId.toString(),
//   );

//   if (!qAttempt) throw new Error("Question attempt not found");

//   qAttempt.userAnswer = answer;
//   qAttempt.isCorrect = isCorrect;
//   qAttempt.answeredAt = new Date();

//   if (isCorrect) {
//     session.score += 1;
//     //  persist interaction AFTER decision
//     session.history.push({
//       questionId,
//       question: question.question,
//       correctAnswer: question.answer,
//       userAnswer: answer,
//       assistantResponse: assistantResponse,
//       action: "ANSWER",
//     });
//   }

//   session.currentQuestionIndex += 1;

//   const totalQuestions = session.questions.length;
//   let isCompleted = false;
//   let nextQuestion = null;

//   if (session.currentQuestionIndex >= totalQuestions) {
//     session.status = "completed";
//     session.endedAt = new Date();
//     isCompleted = true;
//   } else {
//     const nextQAttempt = session.questions[session.currentQuestionIndex];
//     nextQuestion = await Question.findById(nextQAttempt.questionId).lean();
//     nextQuestion = {
//       ...nextQuestion,
//       qNum: session.currentQuestionIndex + 1,
//     };
//   }

//   await session.save();

//   return {
//     isCorrect,
//     assistantResponse,
//     correctAnswer: question.answer,
//     score: session.score,
//     isCompleted,
//     nextQuestion,
//   };
// }
