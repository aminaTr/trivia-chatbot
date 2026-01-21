import { useEffect, useState } from "react";
import socket from "../api/socket";

interface Props {
  sessionId: string;
  questionId: string;
}

export default function HintButton({ sessionId, questionId }: Props) {
  const [hints, setHints] = useState<string[]>([]);

  useEffect(() => {
    const handleHint = (hint: string) => {
      setHints((prev) => [...prev, hint]);
    };

    socket.on("hint", handleHint);

    return () => {
      socket.off("hint", handleHint);
    };
  }, []);

  const requestHint = () => {
    socket.emit("request-hint", { sessionId, questionId });
  };

  return (
    <div>
      <button onClick={requestHint} className="border px-3 py-1">
        Hint
      </button>

      {hints.map((h, i) => (
        <p key={i} className="text-sm text-gray-600">
          {h}
        </p>
      ))}
    </div>
  );
}
