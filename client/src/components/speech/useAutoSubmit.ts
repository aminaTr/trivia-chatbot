import socket from "@/api/socket";
import { isSpeaking } from "./speechManager";
import type { Question } from "@/types/trivia";

export function useAutoSubmit({
  transcript,
  resetTranscript,
  sessionId,
  question,
  sessionStatus,
}: {
  transcript: string;
  resetTranscript: () => void;
  sessionId: string | null;
  question: Question | null;
  sessionStatus: string;
}) {
  if (
    !transcript ||
    !sessionId ||
    !question ||
    sessionStatus !== "active" ||
    isSpeaking()
  )
    return;

  const timeout = setTimeout(() => {
    socket.emit("user-speech", {
      sessionId,
      transcript,
    });
    resetTranscript();
  }, 1500);

  return () => clearTimeout(timeout);
}
