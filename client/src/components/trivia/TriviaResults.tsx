import { useEffect, useState } from "react";
import { fetchSummary } from "@/api/summary";
// import { Button } from "../ui/button";
interface QuestionSummary {
  question: string;
  userAnswer: string;
  isCorrect: boolean;
  hintsUsed: number;
  skipped: boolean;
}

interface TriviaSummary {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  difficulty: string;
  category: string;
  questions: QuestionSummary[];
  startedAt: string;
  endedAt: string;
}

export default function TriviaResults({
  sessionId,
  score,
}: {
  sessionId: string | null;
  score: number;
}) {
  const [summary, setSummary] = useState<TriviaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getSummary = async () => {
    try {
      setLoading(true);
      const response = await fetchSummary({ sessionId });
      if (!response?.ok) {
        throw new Error("Failed to fetch summary");
      }

      const data = await response.json();

      setSummary(data);
    } catch (err) {
      console.error("Error fetching summary:", err);
      setError("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      getSummary();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex gap-3 w-full max-w-md sm:max-w-lg">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
          AI
        </div>
        <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-4 flex-1">
          <p className="text-lg">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex gap-3 w-full max-w-md sm:max-w-lg">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
          AI
        </div>
        <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-4 flex-1">
          <p className="text-lg font-semibold mb-2">🎉 Trivia Completed!</p>
          <p>
            Final score:{" "}
            <span className="font-bold text-2xl text-primary">{score}</span>
          </p>
          {/* <Button onClick={getSummary}>Fetch Again</Button> */}
        </div>
      </div>
    );
  }

  const accuracy = Math.round(
    (summary.correctAnswers / summary.totalQuestions) * 100,
  );

  return (
    <div className="flex gap-3 w-full sm:px-6 ">
      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
        AI
      </div>
      <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-4 py-4 flex-1">
        <p className="text-lg font-semibold mb-3">🎉 Trivia Completed!</p>

        {/* Score Overview */}
        <div className="space-y-2 mb-4">
          <p className="flex items-center justify-between">
            <span>Final Score:</span>
            <span className="font-bold text-2xl text-primary">{score}</span>
          </p>
          <p className="flex items-center justify-between">
            <span>Accuracy:</span>
            <span className="font-semibold text-lg">{accuracy}%</span>
          </p>
          <p className="flex items-center justify-between">
            <span>Correct Answers:</span>
            <span className="font-semibold">
              {summary.correctAnswers}/{summary.totalQuestions}
            </span>
          </p>
          <p className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Category:</span>
            <span className="capitalize">{summary.category}</span>
          </p>
          <p className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Difficulty:</span>
            <span className="capitalize">{summary.difficulty}</span>
          </p>
        </div>

        {/* Question Breakdown */}
        <div className="border-t border-primary/20 pt-4 mt-4">
          <p className="font-semibold mb-3">Question Breakdown:</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {summary.questions.map((q, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border-l-4 ${
                  q.skipped
                    ? "bg-gray-100 dark:bg-gray-800 border-gray-400"
                    : q.isCorrect
                      ? "bg-green-50 dark:bg-green-950/30 border-green-500"
                      : "bg-red-50 dark:bg-red-950/30 border-red-500"
                }`}
              >
                <p className="font-medium text-sm mb-1">
                  {idx + 1}. {q.question}
                </p>
                {q.skipped ? (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    ⏭️ Skipped
                  </p>
                ) : (
                  <>
                    <p className="text-xs">
                      <span
                        className={
                          q.isCorrect
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        Your answer: {q.userAnswer || "No answer"}
                      </span>
                    </p>
                    {q.hintsUsed > 0 && (
                      <p className="text-xs text-muted-foreground">
                        💡 {q.hintsUsed} hint{q.hintsUsed > 1 ? "s" : ""} used
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
