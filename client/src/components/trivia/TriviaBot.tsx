import { useEffect, useState, useRef } from "react";
import socket from "@/api/socket";
import type { Question } from "@/types/trivia";
import { Button } from "@/components/ui/button";
import { useTTS } from "../speech/useTTS";
import { useTriviaSocket } from "../trivia/useTriviaSocket";
import { PlayTriviaButton } from "./PlayTriviaButton";
import TriviaResults from "./TriviaResults";
import { Card } from "../ui/card";
import { toast } from "sonner";
import { startTrivia } from "./StartTrivia";
export default function TriviaBot({
  startedRef,
  started,
  setStarted,
  difficulty,
  category,
  voice,
  startMic,
  stopMic,
  resumeMic,
  sessionStatus,
  setSessionStatus,
  isListeningRef,
}: {
  startedRef: React.RefObject<boolean>;
  started: boolean;
  setStarted: React.Dispatch<React.SetStateAction<boolean>>;
  difficulty: string;
  category: string;
  voice: string;
  startMic: Function;
  stopMic: Function;
  resumeMic: Function;
  sessionStatus: string;
  setSessionStatus: Function;
  isListeningRef: React.RefObject<boolean>;
}) {
  /* ---------------- STATE ---------------- */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const activeQuestionIdRef = useRef<string>("");
  const isSubmittingRef = useRef(false);

  const [score, setScore] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [answerResult, setAnswerResult] = useState<null | {
    correct: boolean;
    correctAnswer: string;
    assistantResponse: string;
  }>(null);

  /* ---------------- SPEECH ---------------- */
  const [transcript, setTranscript] = useState("");
  const cooldownRef = useRef<Record<string, number>>({});

  function canPerform(action: string, cooldownMs: number) {
    const now = Date.now();
    if (
      cooldownRef.current[action] &&
      now - cooldownRef.current[action] < cooldownMs
    ) {
      return false;
    }
    cooldownRef.current[action] = now;
    return true;
  }

  const { speak, isSpeaking } = useTTS(socket, setTranscript);
  const isTTSBlocking = isSpeaking;
  const [actionLock, setActionLock] = useState(false);
  const actionsDisabled = isTTSBlocking || actionLock;

  const transcriptRef = useRef<string>(transcript);
  type UserCommand = "repeat" | "hint" | "skip" | "stop";
  const ACTION_COOLDOWN: Record<UserCommand, number> = {
    repeat: 8000,
    hint: 6000,
    skip: 3000,
    stop: 0, // no cooldown
  };

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const handler = ({
      text,
      isFinal,
      speechFinal,
    }: {
      text: string;
      isFinal: boolean;
      speechFinal: boolean;
    }) => {
      if (!isListeningRef.current) return;
      if (isSubmittingRef.current) return; // 🔒 hard gate

      if (!text?.trim()) return;
      if (!activeQuestionIdRef.current) return;

      // Append only final chunks
      if (isFinal) {
        transcriptRef.current = (transcriptRef.current + " " + text).trim();
        console.log("added to transcript", transcriptRef.current);
      }

      if (speechFinal) {
        const finalText = transcriptRef.current.trim();

        if (finalText.length <= 2) {
          console.log("length less than 2");
          return socket.emit("voice-ready");
        }
        if (!sessionId || !question || sessionStatus !== "active")
          return console.log(
            sessionId,
            question,
            activeQuestionIdRef,
            sessionStatus,
          );

        console.log(
          `🎯 Submitting for Q:${activeQuestionIdRef.current}: "${finalText}"`,
        );
        // 🔒 lock immediately
        isSubmittingRef.current = true;

        // 🎤 stop mic immediately
        stopMic();

        socket.emit("user-speech", {
          sessionId,
          transcript: finalText,
          transcriptQuestionId: activeQuestionIdRef.current,
          type: "speech",
        });

        transcriptRef.current = "";
        setTranscript("");
      }
    };

    socket.on("stt-transcript", handler);
    return () => {
      socket.off("stt-transcript", handler);
    };
  }, [sessionId]);

  /* ---------------- SOCKET ---------------- */
  useTriviaSocket({
    startedRef,
    started,
    setStarted,
    setSessionId,
    question,
    setQuestion,
    activeQuestionIdRef,
    setScore,
    setHints,
    setSessionStatus,
    setAnswerResult,
    setActionLock,
    transcriptRef,
    speak,
    stopMic,
    resumeMic,
    isSubmittingRef,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      socket.emit("stt-stop");
    };
  }, []);

  const sendAction = (command: UserCommand) => {
    console.log("command", command, "isspeaking", isSpeaking);
    if (actionsDisabled) return;
    if (!question) return;

    const cooldown = ACTION_COOLDOWN[command];
    if (cooldown > 0 && !canPerform(command, cooldown)) {
      return toast.error(
        `On cooldown for ${cooldown / 1000} seconds for ${command}`,
      );
    }

    socket.emit("user-speech", {
      sessionId,
      questionId: question._id,
      transcript: command,
      type: "command",
    });

    // lock only for actions that expect speech back
    if (command !== "stop") {
      setActionLock(true);
    }
  };

  /* ---------------- UI ---------------- */

  if (!started && sessionStatus !== "completed") {
    return (
      <div className="flex h-52 justify-center items-center">
        <PlayTriviaButton
          text="Start Playing The Trivia"
          category={category}
          onClick={() =>
            startTrivia(
              startMic,
              startedRef,
              setStarted,
              setSessionStatus,
              difficulty,
              category,
              voice,
            )
          }
        />
      </div>
    );
  }

  if (!question || !sessionId) {
    return <p className="text-center mt-10">Loading trivia...</p>;
  }

  return (
    <div className="flex flex-col h-max">
      {(sessionStatus === "active" && question) || answerResult ? (
        <>
          {/* Top bar */}
          <div className="sticky top-0 z-10 px-4 py-3 flex justify-end border-b bg-background/90 backdrop-blur">
            <span className="font-semibold text-sm text-primary">
              Score: {score}
            </span>
          </div>

          {/* Chat */}
          <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
            {/* AI Question Bubble */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-3 items-start">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                  AI
                </div>

                {/* Message Bubble */}
                <div className="bg-primary/10 rounded-2xl px-4 py-3 max-w-full sm:max-w-[80%] wrap-break-word shadow-sm">
                  {/* Question Number */}
                  <div className="text-xs text-primary font-semibold mb-1 opacity-80">
                    Question {question.qNum}
                  </div>

                  {/* Question Text */}
                  <div className="text-sm leading-relaxed text-foreground">
                    {question.question}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className={`flex gap-2 ml-11 flex-wrap disabled:${isSpeaking}`}
              >
                <Button
                  variant="outline"
                  className="text-xs"
                  size="sm"
                  onClick={() => sendAction("repeat")}
                >
                  🔄 Repeat
                </Button>

                <Button
                  variant="outline"
                  className="text-xs"
                  size="sm"
                  onClick={() => sendAction("hint")}
                >
                  💡 Hint
                </Button>

                <Button
                  variant="outline"
                  className="text-xs"
                  size="sm"
                  onClick={() => sendAction("skip")}
                >
                  🔀 Skip
                </Button>

                <Button
                  variant="outline"
                  className="text-xs"
                  size="sm"
                  onClick={() => sendAction("stop")}
                >
                  🛑 Stop Playing
                </Button>
              </div>
            </div>

            {answerResult && (
              <Card
                className={`ml-11 flex flex-col gap-2 rounded-3xl 
                  px-4 py-3 max-w-[80%] sm:max-w-1/2 wrap-break-word  
                  ${
                    answerResult?.correct
                      ? "border-green-500/40 bg-green-400/20"
                      : "border-red-500/40 bg-red-400/20"
                  }`}
              >
                <div className={`rounded-lg px-3 py-1  wrap-break-word`}>
                  {answerResult?.correct ? "🎉 Correct!" : "❌ Incorrect."} The
                  correct answer {answerResult?.correct ? "is indeed" : "was"}{" "}
                  <span className="font-bold">
                    {answerResult?.correctAnswer}
                  </span>
                </div>
                {/* <div
                  className={`rounded-lg px-3 py-1 text-sm wrap-break-word
                   ${
                     answerResult?.correct
                       ? "bg-green-100/60 text-green-900"
                       : "bg-red-100/60 text-red-900"
                   }`}
                >
                  🤖 Assistant: {answerResult?.assistantResponse}
                </div> */}
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

            {/* User speech bubble
            {transcriptRef?.current && (
              <div className="flex justify-end gap-3">
                <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 max-w-full sm:max-w-[75%] text-right wrap-break-word">
                  <p className="text-xs opacity-70 mb-1">You're saying…</p>
                  {transcriptRef.current}
                </div>
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  You
                </div>
              </div>
            )} */}

            {/* Listening indicator */}
            {!isSpeaking && (
              <div className="flex justify-center">
                <span className="px-4 py-2 rounded-full text-sm bg-primary/10 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Listening…
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex  ">
            {/* Button below results */}
            {/* <div className="ml-11">
                <PlayTriviaButton
                  text="Start Playing The Trivia"
                  category={category}
                  onClick={startTrivia}
                />
              </div> */}
            {/* Results Component */}
            <TriviaResults sessionId={sessionId} score={score} />
            {/* Start Trivia Button */}
            {/* <div className="ml-11">
              <PlayTriviaButton text="Start The Trivia Again" />
            </div> */}
          </div>
        </>
      )}{" "}
    </div>
  );
}
