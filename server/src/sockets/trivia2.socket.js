// trivia.socket.js
import { getSession, startTriviaSession } from "../services/session.service.js";
import { handleUserIntent } from "../services/decisionEngine.service.js";
import {
  generateSpeechStream,
  cleanupTTS,
} from "../services/rime.ws.service.js";
import {
  initSessionRuntime,
  getRuntime,
  advanceQuestion,
  clearRuntime,
} from "../services/state/sessionRuntime.service.js";
import { skipQuestion } from "../services/skip.service.js";
const ttsQueues = new Map();
// Map<socket.id, { promise: Promise, lastText: string | null }>

function enqueueTTS(socket, fn, text) {
  const queue = ttsQueues.get(socket.id) || {
    promise: Promise.resolve(),
    lastText: null,
  };

  // Skip duplicate text already in queue
  if (queue.lastText === text) {
    console.log("Skipping duplicate TTS text:", text);
    return queue.promise;
  }

  const next = queue.promise
    .catch(() => {}) // swallow previous failure
    .then(fn);

  ttsQueues.set(socket.id, { promise: next, lastText: text });
  return next;
}

function streamAndSpeak(socket, text) {
  return enqueueTTS(
    socket,
    async () => {
      console.log("enqueue TTS:", text);

      await generateSpeechStream(text, socket);
    },
    text,
  );
}

export default function triviaSocket(socket, io) {
  socket.on("start-session", async ({ difficulty, category }) => {
    try {
      const { sessionId, firstQuestion, questions } = await startTriviaSession({
        questionCount: 12,
        skip: 2,
        difficulty,
        category,
      });
      initSessionRuntime(sessionId, questions);

      socket.join(sessionId);
      socket.emit("session-started", { sessionId, question: firstQuestion });
    } catch (error) {
      console.error("Start session error:", error);
      socket.emit("error", { message: "Failed to start trivia session" });
    }
  });

  socket.on(
    "user-speech",
    async ({ sessionId, transcript, transcriptQuestionId }) => {
      try {
        const session = await getSession({ sessionId });
        if (!session) throw new Error("Session not found");
        const runtime = getRuntime(sessionId);
        console.log(runtime);
        if (!runtime) throw new Error("Session runtime missing");
        const currentQuestion = session.questions[session.currentQuestionIndex];

        if (!currentQuestion)
          throw new Error("Current question not found in session");

        const questionId = runtime.currentQuestionId;
        const questionText = runtime.currentQuestionText;
        const context = session.history;

        if (transcriptQuestionId && transcriptQuestionId !== questionId) {
          console.log("not the answer to current question");
          return;
        }
        const result = await handleUserIntent({
          sessionId,
          currentQuestion,
          userInput: transcript,
          context,
        });
        console.log("transcript", transcript);
        if (result.isCorrect !== undefined) {
          socket.emit("answer-result", {
            correct: result.isCorrect,
            correctAnswer: result.correctAnswer,
            assistantResponse: result.assistantResponse,
          });
          socket.emit("score-update", { score: result.score });

          if (result.isCompleted) {
            socket.emit("session-ended", { score: result.score });
            return;
          }

          console.log("going to next question", result.nextQuestion.question);
          const runtime = advanceQuestion(
            sessionId,
            session.questions,
            result.nextQuestion.question,
          );
          if (!runtime) {
            socket.emit("session-ended", { score: result.score });
            return;
          }
          socket.emit("next-question", { question: result.nextQuestion });
          return;
        }

        if (result.hint) {
          socket.emit("hint", {
            hint: result.hint,
            assistantResponse: result.assistantResponse,
          });
          console.log("executing in server");
          return;
        }

        if (result.repeat) {
          socket.emit("repeat", {
            assistantResponse: result.assistantResponse,
            questionText: questionText,
          });
          console.log(
            "Repeating ",
            result.assistantResponse + "questionText: " + questionText,
          );
          return;
        }

        if (result.skipped) {
          console.log("skippingg the question", questionId);
          const skipResult = await skipQuestion({ sessionId, questionId });
          if (!skipResult.skipped) {
            socket.emit("skip-failed", {
              assistantResponse:
                skipResult.reason === "NO_SKIPS_LEFT"
                  ? "No more skips available"
                  : skipResult.reason === "ALREADY_SKIPPED"
                    ? "Question already skipped"
                    : "Cannot skip",
            });
            return;
          }
          const nextQuestion = skipResult.nextQuestion;
          advanceQuestion(
            sessionId,
            session.questions,
            skipResult?.nextQuestion?.question || null,
          );

          if (!nextQuestion) {
            socket.emit("skip", {
              assistantResponse: "Skipping the final question.",
              question: null,
            });
            socket.emit("session-ended", { score: session.score });
            return;
          }
          console.log("nextQuestion", nextQuestion);
          socket.emit("skip", {
            assistantResponse: "Skipping this question. On to the next one.",
            question: nextQuestion,
          });

          return;
        }

        if (result.unknown) {
          socket.emit("unknown", {
            assistantResponse: result.assistantResponse,
          });
          return;
        }

        if (result.hintExhausted || result.exhausted) {
          if (result.exhausted) {
            socket.emit("hint-exhausted", {
              assistantResponse:
                "You've exhausted your hints for this question.",
            });
            return;
          }
          const msg =
            result.assistantResponse ||
            "You've exhausted your hints for this question.";
          socket.emit("hint-exhausted", { assistantResponse: msg });
          return;
        }

        if (result.stop) {
          const msg =
            result.assistantResponse || "Okay, stopping trivia early.";
          socket.emit("stop-trivia", { assistantResponse: msg });
          return;
        }
      } catch (err) {
        console.error("Decision engine error:", err);
        socket.emit("error", { message: "Failed to process user speech" });
      }
    },
  );

  // Manual TTS trigger
  socket.on("tts-start", async ({ text }) => {
    try {
      await streamAndSpeak(socket, text);
      // Reset lastText after playback
      const queue = ttsQueues.get(socket.id);
      if (queue) queue.lastText = null;
    } catch (err) {
      console.error("TTS failed:", err);
      socket.emit("tts-error", { message: "TTS failed" });
    }
  });

  // Add handler for manual TTS stop
  socket.on("tts-stop", () => {
    console.log("do nothing");
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    cleanupTTS(socket.id);
    ttsQueues.delete(socket.id);
  });
}
