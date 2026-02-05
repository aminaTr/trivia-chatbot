import { useEffect, useState } from "react";
import socket from "@/api/socket";
import type { Question } from "@/types/trivia";
import { useSpeechRecognition } from "react-speech-recognition";
import SpeechRecognition from "react-speech-recognition";
import { Button } from "@/components/ui/button";

/* hooks */
import { useTTS } from "../speech/useTTS";
import { useTriviaSocket } from "../trivia/useTriviaSocket";
import { useAutoSubmit } from "../speech/useAutoSubmit";
import { isSpeaking } from "../speech/speechManager";
import { Card } from "../ui/card";

export default function TriviaBot({
  startedRef,
  started,
  setStarted,
  difficulty,
  category,
}: {
  startedRef: React.RefObject<boolean>;
  started: boolean;
  setStarted: React.Dispatch<React.SetStateAction<boolean>>;
  difficulty: string;
  category: string;
}) {
  /* ---------------- STATE ---------------- */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "active" | "completed"
  >("idle");
  const [answerResult, setAnswerResult] = useState<null | {
    correct: boolean;
    correctAnswer: string;
    assistantResponse: string;
  }>(null);
  /* ---------------- SPEECH ---------------- */
  const { transcript, resetTranscript } = useSpeechRecognition();
  const { speak, stopSpeech } = useTTS(socket, resetTranscript);

  //   const [assistantResponse, setAssistantResponse] = useState<string>("");

  /* ---------------- START ---------------- */
  const startTrivia = () => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      alert("Speech recognition not supported");
      return;
    }
    console.log("startedRef", startedRef);
    startedRef.current = true; // immediate
    setStarted(true); // UI update

    setSessionStatus("active");
    setScore(0);
    setHints([]);
    setQuestion(null);
    setSessionId(null);

    socket.emit("start-session", { difficulty, category });
  };

  /* ---------------- SOCKET ---------------- */
  useTriviaSocket({
    startedRef,
    started,
    setStarted,
    setSessionId,
    question,
    setQuestion,
    setScore,
    setHints,
    setSessionStatus,
    setAnswerResult,
    speak,
    stopSpeech,
  });

  /* ---------------- AUTO SUBMIT ---------------- */
  useEffect(() => {
    return useAutoSubmit({
      transcript,
      resetTranscript,
      sessionId,
      question,
      sessionStatus,
    });
  }, [transcript, sessionId, question, sessionStatus]);

  /* ---------------- UI ---------------- */
  if (!started) {
    return (
      <div className="flex h-52 justify-center items-center">
        <Button
          variant="outline"
          className="px-6 py-2 rounded-full"
          onClick={startTrivia}
        >
          ▶️ Start Playing The Trivia
        </Button>
      </div>
    );
  }

  if (!question || !sessionId) {
    return <p className="text-center mt-10">Loading trivia...</p>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-10 px-4 py-3 flex justify-end border-b bg-background/90 backdrop-blur">
        <span className="font-semibold text-sm text-primary">
          Score: {score}
        </span>
      </div>

      {/* Chat */}
      <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
        {sessionStatus === "active" && question ? (
          <>
            {/* AI Question Bubble */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  AI
                </div>
                <div className="bg-primary/10 rounded-2xl px-4 py-3 max-w-full sm:max-w-[80%] wrap-break-word">
                  {question.question}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 ml-11 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    socket.emit("user-speech", {
                      sessionId,
                      questionId: question._id,
                      transcript: "repeat",
                    })
                  }
                >
                  🔄 Repeat
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    socket.emit("user-speech", {
                      sessionId,
                      questionId: question._id,
                      transcript: "hint",
                    })
                  }
                >
                  💡 Hint
                </Button>
              </div>
            </div>
            {answerResult && (
              <Card
                className={`ml-11 flex flex-col gap-2 rounded-3xl 
                  px-4 py-3 max-w-[80%] sm:max-w-1/2 wrap-break-word  
                  ${
                    answerResult.correct
                      ? "border-green-500/40 bg-green-400/20"
                      : "border-red-500/40 bg-red-400/20"
                  }`}
              >
                <div className={`rounded-lg px-3 py-1 text-sm wrap-break-word`}>
                  {answerResult.correct ? "✅ Correct!" : "❌ Incorrect."} The
                  correct answer was:{" "}
                  <span className="font-bold">
                    {answerResult.correctAnswer}
                  </span>
                </div>
                <div
                  className={`rounded-lg px-3 py-1 text-sm wrap-break-word
                   ${
                     answerResult.correct
                       ? "bg-green-100/60 text-green-900"
                       : "bg-red-100/60 text-red-900"
                   }`}
                >
                  🤖 Assistant: {answerResult.assistantResponse}
                </div>
              </Card>
            )}

            {hints && hints?.length > 0 && (
              <Card
                className="ml-11 flex flex-col gap-2 rounded-3xl
             border-amber-500/40 bg-amber-400/20
             px-4 py-3 max-w-[80%] sm:max-w-1/2 wrap-break-word"
              >
                {hints.map((hint, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-1 text-sm wrap-break-word
                 bg-amber-100/60 text-amber-900
                 dark:bg-amber-900/40 dark:text-amber-100"
                  >
                    💡 Hint {i + 1}: {hint}
                  </div>
                ))}
              </Card>
            )}

            {/* User speech bubble */}
            {transcript && (
              <div className="flex justify-end gap-3">
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 max-w-full sm:max-w-[75%] text-right wrap-break-word">
                  <p className="text-xs opacity-70 mb-1">You're saying…</p>
                  {transcript}
                </div>
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  You
                </div>
              </div>
            )}

            {/* Assistant Response bubble */}
            {/* {assistantResponse && (
              <div className="flex justify-end gap-3">
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 max-w-full sm:max-w-[75%] text-right wrap-break-word">
                  <p className="text-xs opacity-70 mb-1">You're saying…</p>
                  {assistantResponse}
                </div>
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  You
                </div>
              </div>
            )} */}

            {/* Listening indicator */}
            {!isSpeaking() && (
              <div className="flex justify-center">
                <span className="px-4 py-2 rounded-full text-sm bg-primary/10 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Listening…
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4 items-start">
            {/* AI Completion Bubble */}
            <div className="flex gap-3 w-full max-w-md sm:max-w-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold ">
                AI
              </div>
              <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-4 flex-1 wrap-break-word">
                <p className="text-lg font-semibold mb-2">
                  🎉 Trivia Completed!
                </p>
                <p>
                  Final score:{" "}
                  <span className="font-bold text-2xl text-primary">
                    {score}
                  </span>
                </p>
              </div>
            </div>

            {/* Start Trivia Button */}
            <div className="ml-11">
              <Button
                variant="outline"
                className="px-6 py-2 rounded-full"
                onClick={startTrivia}
              >
                ▶️ Start Another Trivia
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
