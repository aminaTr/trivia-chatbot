import { useState } from "react";
import socket from "../api/socket";
import type { Question, AnswerResult } from "../types/trivia";
import HintButton from "./HintButton";
import { speakText } from "../lib/speechSynthesis";

interface Props {
  question: Question;
  sessionId: string;
}

export default function QuestionCard({ question, sessionId }: Props) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const submitAnswer = () => {
    socket.emit("submit-answer", {
      sessionId,
      questionId: question._id,
      answer,
    });

    socket.once("answer-result", (data: AnswerResult) => {
      setResult(data.assistantResponse);
      speakText(data.assistantResponse);
    });
  };

  return (
    <div className="border p-4 rounded">
      <h2 className="text-lg font-semibold">{question.question}</h2>

      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="border p-2 w-full mt-2"
        placeholder="Your answer"
      />

      <div className="flex gap-2 mt-2">
        <button
          onClick={submitAnswer}
          className="bg-black text-white px-4 py-2"
        >
          Submit
        </button>

        <HintButton sessionId={sessionId} questionId={question._id} />
      </div>

      {result && <p className="mt-2">{result}</p>}
    </div>
  );
}
