import { useEffect, useRef, useState } from "react";
import socket from "../api/socket";
import type { AnswerResult, Question } from "../types/trivia";
import { useSpeechRecognition } from "react-speech-recognition";
import SpeechRecognition from "react-speech-recognition";
import { Button } from "../components/ui/button";

import { getAudio } from "../api/audio";

/* --------------------------------------------------
   TTS (RIME)
-------------------------------------------------- */
export default function TriviaBot({
  started,
  setStarted,
  difficulty,
  category,
}: {
  started: boolean;
  setStarted: (value: boolean) => void;
  difficulty: string;
  category: string;
}) {
  /* --------------------------------------------------
     STATE
  -------------------------------------------------- */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "active" | "completed"
  >("idle");
  const [hints, setHints] = useState<string[]>([]);

  /* --------------------------------------------------
     REFS (speech + socket timing)
  -------------------------------------------------- */
  const isSpeakingRef = useRef(false);
  const pendingQuestionRef = useRef<Question | null>(null);

  const { transcript, resetTranscript } = useSpeechRecognition();

  /* --------------------------------------------------
     START TRIVIA
  -------------------------------------------------- */
  async function speakText(text: string): Promise<void> {
    isSpeakingRef.current = true;
    SpeechRecognition.stopListening();
    return new Promise(async (resolve) => {
      try {
        const { audio, audioUrl } = await getAudio(text);

        audio.onended = audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          isSpeakingRef.current = false; // resume listening
          resetTranscript();
          SpeechRecognition.startListening({
            continuous: true,
            language: "en-US",
          });

          resolve();
        };

        audio.play();
      } catch {
        isSpeakingRef.current = false; // resume even on error
        resetTranscript();
        SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        });
        resolve();
      }
    });
  }

  const startTrivia = () => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      alert("Speech recognition not supported");
      return;
    }

    setStarted(true);
    setSessionStatus("active");
    setScore(0);
    setHints([]);
    setQuestion(null);
    setSessionId(null);

    socket.emit("start-session", { difficulty, category });
  };

  /* --------------------------------------------------
     SOCKET EVENTS
  -------------------------------------------------- */
  useEffect(() => {
    if (!started) return;

    let isMounted = true; // safeguard

    /* ---------------------------
     SESSION START
  --------------------------- */
    const handleSessionStart = async ({
      sessionId,
      question,
    }: {
      sessionId: string;
      question: Question;
    }) => {
      if (!isMounted) return;
      setSessionId(sessionId);
      setQuestion(question);

      await speakText(question.question);
    };

    socket.on("session-started", handleSessionStart);

    /* ---------------------------
     HINT
  --------------------------- */
    const handleHint = async ({
      hint,
      assistantResponse,
    }: {
      hint: string;
      assistantResponse: string;
    }) => {
      if (!isMounted) return;
      isSpeakingRef.current = true;
      console.log("hint", hint);
      setHints((prev) => [...prev, hint]);
      await speakText(assistantResponse);
      await speakText(hint);
    };

    socket.on("hint", handleHint);

    /* ---------------------------
     REPEAT
  --------------------------- */
    const handleRepeat = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      if (!isMounted || !question) return;
      await speakText(assistantResponse);
      await speakText(question.question);
    };

    socket.on("repeat", handleRepeat);

    const handleHintExhausted = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      if (!isMounted) return;
      await speakText(assistantResponse);
    };
    socket.on("hint-exhausted", handleHintExhausted);

    const handleUnknown = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      if (!isMounted) return;
      await speakText(assistantResponse);
    };

    socket.on("unknown", handleUnknown);

    const handleStopEarly = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      if (!isMounted) return;
      setSessionStatus("completed");
      await speakText(assistantResponse);
    };

    socket.on("stop-trivia", handleStopEarly);

    /* ---------------------------
     NEXT QUESTION
    --------------------------- */
    const handleNextQuestion = async ({ question }: { question: Question }) => {
      if (!isMounted) return;
      if (isSpeakingRef.current) {
        pendingQuestionRef.current = question;
        return;
      }
      setQuestion(question);
      await speakText(question.question);
      console.log("hints", hints);
    };

    socket.on("next-question", handleNextQuestion);

    /* ---------------------------
     SCORE UPDATE
  --------------------------- */
    const handleScoreUpdate = ({ score }: { score: number }) => {
      if (!isMounted) return;
      setScore(score);
    };

    socket.on("score-update", handleScoreUpdate);

    /* ---------------------------
     ANSWER RESULT
  --------------------------- */
    const handleAnswerResult = async (data: AnswerResult) => {
      if (!isMounted) return;

      await speakText(data.assistantResponse);

      if (pendingQuestionRef.current) {
        const q = pendingQuestionRef.current;
        pendingQuestionRef.current = null;

        setQuestion(q);
        await speakText(q.question);
      }
    };

    socket.on("answer-result", handleAnswerResult);

    /* ---------------------------
     SESSION END
  --------------------------- */
    const handleSessionEnd = async ({ score }: { score: number }) => {
      if (!isMounted) return;

      while (isSpeakingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setScore(score);
      setSessionStatus("completed");
      await speakText(`Trivia completed. Your final score is ${score}`);
      SpeechRecognition.stopListening();
    };

    socket.on("session-ended", handleSessionEnd);

    /* ---------------------------
     CLEANUP
  --------------------------- */
    return () => {
      isMounted = false; // stop async callbacks
      socket.off("session-started", handleSessionStart);
      socket.off("hint", handleHint);
      socket.off("repeat", handleRepeat);
      socket.off("next-question", handleNextQuestion);
      socket.off("score-update", handleScoreUpdate);
      socket.off("answer-result", handleAnswerResult);
      socket.off("session-ended", handleSessionEnd);
    };
  }, [started, question, resetTranscript]);

  /* --------------------------------------------------
     AUTO SUBMIT VOICE ANSWER
  -------------------------------------------------- */
  useEffect(() => {
    if (
      !transcript ||
      !sessionId ||
      !question ||
      sessionStatus !== "active" ||
      isSpeakingRef.current
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      socket.emit("user-speech", {
        sessionId,
        questionId: question._id,
        transcript,
      });
      resetTranscript();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [transcript, sessionId, question, sessionStatus, resetTranscript]);

  useEffect(() => {
    // Clear hints every time question changes
    setHints([]);
  }, [question]);

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */
  if (!started) {
    return (
      <div className="flex justify-center ">
        <Button variant={"ghost"} onClick={startTrivia}>
          Start Trivia
        </Button>
      </div>
    );
  }

  if (!question || !sessionId) {
    return <p className="text-center mt-10">Loading trivia...</p>;
  }

  return (
    <div className="">
      <div className="flex flex-col h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-10 px-4 py-3 flex justify-end items-center border-b bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          {sessionStatus && (
            <span className="font-semibold text-sm text-primary dark:text-primary-foreground">
              Score: {score}
            </span>
          )}
        </div>

        {/* Chat bubbles */}
        <div className="flex-1 px-4 py-6 flex flex-col space-y-4 overflow-y-auto">
          {sessionStatus === "active" ? (
            <>
              {/* AI bubble */}
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AI</span>
                </div>
                <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-3 max-w-[80%] text-secondary-foreground dark:text-primary">
                  {question.question}
                </div>
              </div>

              {/* Hints */}
              {hints.length > 0 && (
                <div className="flex flex-col space-y-2 ml-10">
                  {hints.map((h, i) => (
                    <span
                      key={i}
                      className="bg-secondary/20 dark:bg-secondary/30 px-3 py-1 rounded-lg text-sm text-secondary-foreground"
                    >
                      💡 Hint {i + 1}: {h}
                    </span>
                  ))}
                </div>
              )}

              {/* User bubble */}
              {transcript && (
                <div className="flex gap-3 items-start justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 max-w-[75%] break-words text-right">
                    <p className="text-xs opacity-70 mb-1">You're saying...</p>
                    <p>{transcript}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">You</span>
                  </div>
                </div>
              )}

              {/* Listening */}
              {!isSpeakingRef.current && (
                <div className="flex justify-center">
                  <span className="bg-primary/10 dark:bg-primary/20 px-4 py-2 rounded-full text-sm text-secondary-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Listening...
                  </span>
                </div>
              )}
            </>
          ) : (
            // Trivia completed
            <div className="flex gap-3 items-start w-full">
              <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                <span className="text-white font-bold text-xs">AI</span>
              </div>
              <div className="justify-center flex flex-col px-6 py-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-secondary-foreground dark:text-primary w-full">
                <p className="text-lg font-semibold mb-2 ">
                  🎉 Trivia Completed!
                </p>
                <p>
                  Your final score:{" "}
                  <span className="font-bold text-2xl text-primary">
                    {score}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Buttons below chat */}
        <div className="px-4 py-4 flex gap-2 justify-center border-t bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          {sessionStatus === "active" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  socket.emit("user-speech", {
                    sessionId,
                    questionId: question._id,
                    transcript: "repeat",
                  })
                }
              >
                🔄 Repeat Question
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  socket.emit("user-speech", {
                    sessionId,
                    questionId: question._id,
                    transcript: "hint",
                  })
                }
              >
                💡 Get Hint
              </Button>
            </>
          ) : (
            <Button
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={startTrivia}
            >
              ▶️ Start Another Trivia
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
