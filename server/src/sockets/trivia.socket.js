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
  skipQuestionRuntime,
  advanceQuestion,
  clearRuntime,
  getCurrentQuestionId,
  getCurrentQuestionText,
} from "../services/state/sessionRuntime.service.js";
import { skipQuestion } from "../services/skip.service.js";
import { voiceState } from "../services/state/voice.server.state.js";

const ttsQueues = new Map();
const submissionCooldowns = new Map(); // sessionId -> { questionId, timestamp }
let selectedVoice = "astra";
const COOLDOWN_MS = 2000; // 2 seconds cooldown per question

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
      console.log("selectedVoice", selectedVoice);
      await generateSpeechStream(text, socket, selectedVoice);
    },
    text,
  );
}

async function rebuildRuntimeFromSession(sessionId) {
  console.log("Rebuilding runtime");
  const session = (await getSession({ sessionId })) || {};
  const {
    questions = [],
    skips = 0,
    skipped = 0,
    currentQuestionIndex = 0,
  } = session;
  if (!questions) console.error("Invalid session id");
  initSessionRuntime(
    sessionId,
    questions,
    skips,
    skipped,
    currentQuestionIndex,
  );
  return getRuntime(sessionId);
}

export default function triviaSocket(socket, io) {
  socket.on("start-session", async ({ difficulty, category, voice }) => {
    try {
      selectedVoice = voice;
      const { sessionId, firstQuestion, questions, skips } =
        await startTriviaSession({
          questionCount: 12,
          skips: 2,
          difficulty,
          category,
        });
      initSessionRuntime(sessionId, questions, skips, 0);
      console.log(selectedVoice, "on start session");
      socket.join(sessionId);
      socket.emit("session-started", { sessionId, question: firstQuestion });
    } catch (error) {
      console.error("Start session error:", error);
      socket.emit("error", { message: "Failed to start trivia session" });
    }
  });

  socket.on(
    "user-speech",
    async ({ sessionId, transcript, transcriptQuestionId, type }) => {
      try {
        const state = voiceState.get(socket.id);
        if (state !== "UTTERANCE_COMPLETE" && type !== "command") {
          console.log("❌ Rejecting submission, invalid state:", state);
          return;
        }

        console.log("📤 Transition → PROCESSING");
        voiceState.set(socket.id, "PROCESSING");
        let runtime = getRuntime(sessionId);

        if (!runtime) {
          runtime = await rebuildRuntimeFromSession(sessionId);
          if (!runtime) throw new Error("Session runtime missing");
        }

        // Now runtime is guaranteed
        const questionId = getCurrentQuestionId(sessionId);
        const questionText = getCurrentQuestionText(sessionId);

        // const context = session.history;
        console.log(questionId);
        // ✅ Check if transcript is for the wrong question
        if (transcriptQuestionId && transcriptQuestionId !== questionId) {
          console.log(
            "Not the answer to current question",
            transcriptQuestionId,
            questionId,
          );
          return;
        }

        // ✅ CHECK COOLDOWN - prevent rapid duplicate submissions
        const cooldownKey = `${sessionId}-${questionId}`;
        const lastSubmission = submissionCooldowns.get(cooldownKey);
        const now = Date.now();

        if (lastSubmission && now - lastSubmission < COOLDOWN_MS) {
          console.log(
            `🛑 Cooldown active: Ignoring duplicate submission for ${questionId} (${now - lastSubmission}ms ago)`,
          );
          return;
        }

        // ✅ SET COOLDOWN
        submissionCooldowns.set(cooldownKey, now);

        // Clean up old cooldowns (optional, prevents memory leak)
        if (submissionCooldowns.size > 1000) {
          const entries = Array.from(submissionCooldowns.entries());
          entries.sort((a, b) => b[1] - a[1]);
          submissionCooldowns.clear();
          entries
            .slice(0, 500)
            .forEach(([k, v]) => submissionCooldowns.set(k, v));
        }
        const result = await handleUserIntent({
          sessionId,
          questionId,
          userInput: transcript,
          // context,
        });
        console.log("handleuserintent returned", result.assistantResponse);
        console.log("transcript", transcript);

        if (result.isCorrect !== undefined) {
          // ✅ CLEAR COOLDOWN when moving to next question
          submissionCooldowns.delete(cooldownKey);

          socket.emit("answer-result", {
            correct: result.isCorrect,
            correctAnswer: result.correctAnswer,
            assistantResponse: result.assistantResponse,
          });
          socket.emit("score-update", { score: result.score });

          if (result.isCompleted) {
            clearRuntime(sessionId);
            socket.emit("session-ended", { score: result.score });
            return;
          }

          console.log("going to next question", result.nextQuestion.question);
          runtime = advanceQuestion(sessionId);
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
          return;
        }

        if (result.repeat) {
          socket.emit("repeat", {
            assistantResponse: result.assistantResponse,
            questionText: questionText,
          });
          return;
        }

        if (result.skipped) {
          console.log("skipping the question", questionId);
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
          runtime = skipQuestionRuntime(sessionId);

          if (!nextQuestion) {
            socket.emit("skip", {
              assistantResponse: "Skipping the final question.",
              question: null,
            });
            socket.emit("session-ended", { score: skipResult.score });
            return;
          }
          // ✅ CLEAR COOLDOWN when moving to next question
          submissionCooldowns.delete(cooldownKey);
          console.log("runtime:", runtime);
          console.log("nextQuestion", nextQuestion);
          socket.emit("skip", {
            assistantResponse: "Skipping this question. ",
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
          clearRuntime(sessionId);
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

  socket.on("voice-ready", () => {
    voiceState.set(socket.id, "LISTENING");
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
    voiceState.delete(socket.id);
  });
}
