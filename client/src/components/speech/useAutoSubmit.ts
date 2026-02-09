// import socket from "@/api/socket";
// // import { isSpeaking } from "./speechManager";
// import type { Question } from "@/types/trivia";

// export function useAutoSubmit({
//   transcript,
//   resetTranscript,
//   sessionId,
//   question,
//   sessionStatus,
// }: {
//   transcript: string;
//   resetTranscript: () => void;
//   sessionId: string | null;
//   question: Question | null;
//   sessionStatus: string;
// }) {
//   if (
//     !transcript ||
//     !sessionId ||
//     !question ||
//     sessionStatus !== "active"
//     // || isSpeaking()
//   )
//     return;

//   const timeout = setTimeout(() => {
//     socket.emit("user-speech", {
//       sessionId,
//       transcript,
//     });
//     resetTranscript();
//   }, 1500);

//   return () => clearTimeout(timeout);
// }
import { useEffect, useRef } from "react";
import socket from "@/api/socket";
import type { Question } from "@/types/trivia";

export function useAutoSubmit({
  shouldSubmitRef,
  transcript,
  resetTranscript,
  sessionId,
  question,
  sessionStatus,
}: {
  shouldSubmitRef: React.RefObject<boolean>;
  transcript: string;
  resetTranscript: () => void;
  sessionId: string | null;
  question: Question | null;
  sessionStatus: string;
}) {
  const timeoutRef = useRef<number | null>(null); // ✅ browser-friendly

  useEffect(() => {
    if (
      !shouldSubmitRef.current ||
      !transcript ||
      !sessionId ||
      !question ||
      sessionStatus !== "active"
    ) {
      return;
    }

    // Clear previous timeout if any
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Wait 1.5s before auto-submitting
    timeoutRef.current = setTimeout(() => {
      console.log("transcript", transcript);
      socket.emit("user-speech", {
        sessionId,
        transcript,
        transcriptQuestionId: question?._id,
      });
      resetTranscript();
      // stopMic();
      // Reset the trigger
      shouldSubmitRef.current = false;
    }, 1500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    shouldSubmitRef,
    transcript,
    sessionId,
    question,
    sessionStatus,
    resetTranscript,
  ]);
}
