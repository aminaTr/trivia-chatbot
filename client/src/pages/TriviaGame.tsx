import { useEffect, useState } from "react";
import socket from "../api/socket";
import type { Question } from "../types/trivia";
import ScoreBoard from "../components/ScoreBoard";
import { useSpeechRecognition } from "react-speech-recognition";
import SpeechRecognition from "react-speech-recognition";

// Utility to speak text
export function speakText(text: string) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export default function TriviaGame() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState<number>(0);
  const [sessionStatus, setSessionStatus] = useState<string>("active");

  const { transcript, resetTranscript } = useSpeechRecognition();

  useEffect(() => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      alert("Your browser does not support speech recognition");
      return;
    }

    // Start listening
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });

    // Cleanup must be synchronous
    return () => {
      SpeechRecognition.stopListening(); // don't return the promise
    };
  }, []);

  // Socket events
  useEffect(() => {
    socket.emit("start-session");

    socket.on(
      "session-started",
      (data: { sessionId: string; question: Question }) => {
        setSessionId(data.sessionId);
        setQuestion(data.question);
        speakText(data.question.question);
      },
    );

    socket.on("next-question", (data: { question: Question }) => {
      setQuestion(data.question);
      resetTranscript();
      speakText(data.question.question);
    });

    socket.on("score-update", (data: { score: number }) =>
      setScore(data.score),
    );

    socket.on(
      "answer-result",
      (data: {
        correct: boolean;
        correctAnswer?: string;
        assistantResponse?: string;
      }) => {
        const text = data.correct
          ? "Correct!"
          : `Incorrect. The correct answer is ${data.correctAnswer}`;
        speakText(text + data.assistantResponse);
      },
    );

    socket.on("session-ended", (data: { score: number }) => {
      setScore(data.score);
      setSessionStatus("completed");
      speakText(`Trivia Completed. Your final score is ${data.score}`);
    });

    return () => {
      socket.off();
    };
  }, []);

  // Auto-submit voice answer after short pause
  useEffect(() => {
    if (!transcript || !sessionId || !question) return;

    const timeout = setTimeout(() => {
      socket.emit("submit-answer", {
        sessionId,
        questionId: question._id,
        answer: transcript,
      });
      resetTranscript();
    }, 1500); // 1.5s pause after speech stops

    return () => clearTimeout(timeout);
  }, [transcript, sessionId, question]);

  if (!question || !sessionId)
    return <p className="text-center mt-10">Loading trivia...</p>;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <ScoreBoard score={score} />
      {sessionStatus === "active" ? (
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-2">{question.question}</h2>
          <p className="text-gray-500 text-sm">Answer by speaking aloud</p>
          <p className="mt-2 text-blue-600 font-medium">
            You said: {transcript}
          </p>
        </div>
      ) : (
        <p className="text-center font-semibold text-xl">
          Trivia Completed! Final score: {score}
        </p>
      )}
    </div>
  );
}

// import { useEffect, useState } from "react";
// import socket from "../api/socket";
// import type { Question } from "../types/trivia";
// import QuestionCard from "../components/QuestionCard";
// import ScoreBoard from "../components/ScoreBoard";
// import { useSpeechRecognition } from "react-speech-recognition";
// import { speakQuestion } from "../lib/speechSynthesis";

// export default function TriviaGame() {
//   const [sessionId, setSessionId] = useState<string | null>(null);
//   const [question, setQuestion] = useState<Question | null>(null);
//   const [score, setScore] = useState<number>(0);
//   const [sessionStatus, setSessionStatus] = useState<string>("active");
//   const { transcript, resetTranscript } = useSpeechRecognition();

//   useEffect(() => {
//     socket.emit("start-session");

//     socket.on(
//       "session-started",
//       (data: { sessionId: string; question: Question }) => {
//         setSessionId(data.sessionId);
//         setQuestion(data.question);
//         speakQuestion(data.question.question);
//       },
//     );

//     socket.on("next-question", (data: { question: Question }) => {
//       console.log("next question");
//       setQuestion(data.question);
//       speakQuestion(data.question.question);
//     });

//     socket.on("score-update", (data: { score: number }) => {
//       console.log("score update");
//       setScore(data.score);
//     });

//     socket.on("session-ended", (data: { score: number }) => {
//       setScore(data.score);
//       setSessionStatus("completed");
//     });
//     return () => {
//       socket.off();
//     };
//   }, []);

//   useEffect(() => {
//     if (!transcript || !sessionId || !question) return;
//     console.log("transcript", transcript);
//     // When user finishes speaking (you can add a timeout)
//     socket.emit("submit-answer", {
//       sessionId,
//       questionId: question._id,
//       answer: transcript,
//     });

//     resetTranscript();
//   }, [transcript]);

//   if (!question || !sessionId) return <p>Loading...</p>;

//   return (
//     <div className="p-6 max-w-xl mx-auto">
//       <ScoreBoard score={score} />
//       {sessionStatus === "active" ? (
//         <QuestionCard question={question} sessionId={sessionId} />
//       ) : (
//         "Trivia Completed"
//       )}
//     </div>
//   );
// }
