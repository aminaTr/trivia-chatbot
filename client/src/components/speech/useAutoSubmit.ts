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
  transcriptRef,
  activeQuestionIdRef,
  resetTranscript,
  sessionId,
  question,
  sessionStatus,
}: {
  shouldSubmitRef: React.RefObject<boolean>;
  transcriptRef: React.RefObject<string>;
  activeQuestionIdRef: React.RefObject<string>;
  resetTranscript: () => void;
  sessionId: string | null;
  question: Question | null;
  sessionStatus: string;
}) {
  const timeoutRef = useRef<number | null>(null); // browser-friendly

  useEffect(() => {
    console.log(transcriptRef.current, "in auto submit");
    if (
      !shouldSubmitRef.current ||
      !transcriptRef.current.trim() ||
      !sessionId ||
      !question ||
      sessionStatus !== "active"
    ) {
      return console.log(
        "!shouldSubmitRef.current",
        !shouldSubmitRef.current,
        "!transcriptRef.current.trim()",
        !transcriptRef.current.trim(),
        "!sessionId",
        !sessionId,
        "!question",
        !question,
        "sessionStatus is not active",
        sessionStatus !== "active",
      );
    }

    if (question._id !== activeQuestionIdRef.current) {
      console.log(
        `🔙 Returning with question ${question.question} and activeQuestionIdRef ${activeQuestionIdRef.current}`,
      );
      return;
    }
    // Clear previous timeout if any
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Wait 1.5s before auto-submitting
    timeoutRef.current = setTimeout(() => {
      console.log("transcript", transcriptRef.current);
      socket.emit("user-speech", {
        sessionId,
        transcript: transcriptRef.current,
        transcriptQuestionId: question?._id,
      });
      transcriptRef.current = "";
      // Reset the trigger
      shouldSubmitRef.current = false;
    }, 1500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    shouldSubmitRef,
    transcriptRef,
    activeQuestionIdRef,
    sessionId,
    question,
    sessionStatus,
    resetTranscript,
  ]);
}
