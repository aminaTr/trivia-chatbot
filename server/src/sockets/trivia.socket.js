import { getSession, startTriviaSession } from "../services/session.service.js";
import { handleUserIntent } from "../services/decisionEngine.service.js";

export default function triviaSocket(socket, io) {
  socket.on("start-session", async ({ difficulty, category }) => {
    try {
      console.log("socket", difficulty);
      const { sessionId, firstQuestion } = await startTriviaSession({
        questionCount: 12,
        skip: 2,
        difficulty,
        category,
      });

      socket.join(sessionId);

      socket.emit("session-started", {
        sessionId,
        question: firstQuestion,
      });
    } catch (error) {
      console.error("Start session error:", error);

      socket.emit("error", {
        message: "Failed to start trivia session",
      });
    }
  });
  socket.on("user-speech", async ({ sessionId, questionId, transcript }) => {
    try {
      const session = await getSession({ sessionId });
      if (!session) throw new Error("Session not found");

      const context = session.history;
      const result = await handleUserIntent({
        sessionId,
        questionId,
        userInput: transcript,
        context,
      });
      console.log("result", result);

      // 1️⃣ Answer result
      if (result.isCorrect !== undefined) {
        socket.emit("answer-result", {
          correct: result.isCorrect,
          correctAnswer: result.correctAnswer,
          assistantResponse: result.assistantResponse,
        });
        socket.emit("score-update", { score: result.score });

        if (result.isCompleted) {
          socket.emit("session-ended", { score: result.score });
        } else {
          console.log("next question");
          socket.emit("next-question", { question: result.nextQuestion });
        }
        return;
      }

      // 2️⃣ Hint
      if (result.hint) {
        socket.emit("hint", {
          hint: result.hint,
          assistantResponse: result.assistantResponse,
        });
        return;
      }

      // 3️⃣ Skip
      if (result.skipped) {
        socket.emit("skip", { assistantResponse: result.assistantResponse }); // frontend triggers next question
        return;
      }

      // 4️⃣ Repeat
      if (result.repeat) {
        console.log("Emitting repeat");
        socket.emit("repeat", { assistantResponse: result.assistantResponse }); // frontend repeats current question
        return;
      }

      // 5️⃣ Unknown
      if (result.unknown) {
        socket.emit("unknown", {
          assistantResponse: result.assistantResponse,
        });
        return;
      }

      if (result.hintExhausted || result.exhausted) {
        socket.emit("hint-exhausted", {
          assistantResponse: result.hintExhausted
            ? result?.assistantResponse ||
              "You've exhausted your hints for this question."
            : "No more hints available for this question.",
        });
        return;
      }

      if (result.stop) {
        console.log("Emitting stop");
        socket.emit("stop-trivia", {
          assistantResponse:
            result?.assistantResponse || "Okay, stopping trivia early.",
        });
        return;
      }
    } catch (err) {
      console.error("Decision engine error:", err);
      socket.emit("error", { message: "Failed to process user speech" });
    }
  });
}
