import { useEffect, useState, useRef } from "react";
import socket from "@/api/socket";
import type { Question } from "@/types/trivia";
import { Button } from "@/components/ui/button";
import { useTTS } from "../speech/useTTS";
import { useTriviaSocket } from "../trivia/useTriviaSocket";
import { useAutoSubmit } from "../speech/useAutoSubmit";
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
  const [transcript, setTranscript] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { speak } = useTTS(socket, setTranscript);
  const shouldSubmitRef = useRef(false);
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useAutoSubmit({
    shouldSubmitRef,
    transcript,
    resetTranscript: () => setTranscript(""),
    sessionId,
    question,
    sessionStatus,
  });

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
      if (!text) return;

      if (isFinal) {
        setTranscript((prev) => prev + " " + text);
      }

      if (speechFinal) {
        shouldSubmitRef.current = true;
      }
    };

    socket.on("stt-transcript", handler);

    return () => {
      socket.off("stt-transcript", handler);
    };
  }, []);

  /* ---------------- MIC CONTROLS ---------------- */
  const startMic = async () => {
    try {
      // Restart Deepgram for new question
      socket.emit("stt-stop");
      setTimeout(() => {
        socket.emit("stt-start");
      }, 500);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create AudioContext for Linear16 conversion
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(
        4096,
        1,
        1,
      );

      processorRef.current.onaudioprocess = (e) => {
        const float32Data = e.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(float32Data.length);

        // Calculate volume for debugging
        let sum = 0;
        for (let i = 0; i < float32Data.length; i++) {
          sum += Math.abs(float32Data[i]);
          // Convert Float32 to Int16
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const volume = sum / float32Data.length;
        if (volume > 0.01) {
          console.log("🔊 Audio detected! Volume:", volume.toFixed(4));
        }

        socket.emit("audio-chunk", int16Data.buffer);
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      console.log("🎤 Mic streaming started (Linear16)");
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopMic = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    console.log("⏸️ Mic stopped");
  };

  const resumeMic = () => {
    if (!audioContextRef.current) {
      startMic();
    } else if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
      console.log("▶️ Mic resumed");
    }
  };

  /* ---------------- START ---------------- */
  const startTrivia = () => {
    socket.emit("stt-start");

    startedRef.current = true;
    setStarted(true);
    setSessionStatus("active");

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
    stopMic,
    resumeMic,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      socket.emit("stt-stop");
    };
  }, []);

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
        {(sessionStatus === "active" && question) || answerResult ? (
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

            {/* Listening indicator */}
            {
              <div className="flex justify-center">
                <span className="px-4 py-2 rounded-full text-sm bg-primary/10 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Listening…
                </span>
              </div>
            }
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
