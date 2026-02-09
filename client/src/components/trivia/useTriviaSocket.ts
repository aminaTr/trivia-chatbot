import { useEffect } from "react";
import socket from "@/api/socket";
import type { AnswerResult, Question } from "@/types/trivia";
import { useRef } from "react";
export function useTriviaSocket({
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
  resumeMic,
  stopMic,
}: {
  startedRef: React.RefObject<boolean>;
  started: boolean;
  setStarted: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionId: Function;
  question: Question | null;
  setQuestion: Function;
  setScore: Function;
  setHints: Function;
  setSessionStatus: Function;
  setAnswerResult: Function;
  // speak: (text: string) => Promise<void>;
  speak: (
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
  ) => Promise<void>;
  resumeMic: Function;
  stopMic: Function;
}) {
  const questionRef = useRef<Question | null>(question);
  const pendingQuestionRef = useRef<Question | null>(null);
  const assistantSpeechDoneRef = useRef(false);
  const answerShownRef = useRef(false);

  useEffect(() => {
    questionRef.current = question;
    setHints([]);
  }, [question]);

  useEffect(() => {
    if (!started) return;

    const onSessionStarted = async ({ sessionId, question }: any) => {
      setSessionId(sessionId);
      setStarted(true);
      startedRef.current = true;
      setQuestion(question);
      setHints([]);
      setSessionStatus("active");
      // await speak(question.question);
      speak(
        question.question,
        () => stopMic(), // onStart callback
        () => resumeMic(), // onEnd callback
      );
    };

    const onHint = async ({
      hint,
      assistantResponse,
    }: {
      hint: string;
      assistantResponse: string;
    }) => {
      setHints((h: string[]) => [...h, hint]);
      // await speak(assistantResponse + ": " + hint);
      await speak(
        assistantResponse + ": " + hint,
        () => stopMic(), // onStart callback
        () => resumeMic(),
      );
    };

    const onSkip = async ({
      assistantResponse,
      question,
    }: {
      assistantResponse: string;
      question: Question | null;
    }) => {
      console.log("new q", question);

      pendingQuestionRef.current = question;

      let speechText = assistantResponse || "Skipping this question.";

      if (question) {
        speechText += ` Next question: ${question.question}`;
      }

      await speak(
        speechText,
        () => stopMic(),
        () => resumeMic(),
      );

      if (question) {
        setQuestion(question);
        setHints([]);
      }
    };

    const onSkipFailed = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      await speak(
        assistantResponse || "Unable to skip the question.",
        () => stopMic(),
        () => resumeMic(),
      );
    };

    const onAnswerResult = async (res: AnswerResult) => {
      setAnswerResult(res);
      answerShownRef.current = true;

      assistantSpeechDoneRef.current = false;
      await speak(
        res.assistantResponse,
        () => stopMic(),
        () => resumeMic(),
      );
      assistantSpeechDoneRef.current = true;

      flushNextQuestion();
    };

    const onNextQuestion = ({ question }: { question: Question }) => {
      console.log("new question received", question);
      pendingQuestionRef.current = question;

      // flushNextQuestion();
    };
    // const flushNextQuestion = async () => {
    //   if (assistantSpeechDoneRef.current && pendingQuestionRef.current) {
    //     const q = pendingQuestionRef.current;
    //     pendingQuestionRef.current = null;
    //     assistantSpeechDoneRef.current = false;
    //     setQuestion(q);
    //     setHints([]);
    //     console.log("flushed");
    //     await speak(q.question);
    //   }
    // };
    const flushNextQuestion = async () => {
      if (
        assistantSpeechDoneRef.current &&
        pendingQuestionRef.current &&
        answerShownRef.current
      ) {
        const q = pendingQuestionRef.current;
        pendingQuestionRef.current = null;

        assistantSpeechDoneRef.current = false;
        answerShownRef.current = false;

        setAnswerResult(null); // hide previous result
        setQuestion(q);
        setHints([]);

        console.log("flushed");
        await speak(
          q.question,
          () => stopMic(),
          () => resumeMic(),
        );
      }
    };

    const onScoreUpdate = ({ score }: any) => setScore(score);

    const onSessionEnded = async ({ score }: any) => {
      setScore(score);
      setStarted(false);
      startedRef.current = false;

      setSessionStatus("completed");
      await speak(
        `Trivia completed. Your score is ${score}`,
        () => stopMic(),
        () => resumeMic(),
      );
      stopMic();
      // stopSpeech();
    };

    const handleStopEarly = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      console.log("stopping trivia");
      setSessionStatus("completed");
      setStarted(false);
      startedRef.current = false;
      await speak(
        assistantResponse,
        () => stopMic(),
        () => resumeMic(),
      );
      stopMic();
      // stopSpeech();
    };

    const handleRepeat = async ({
      assistantResponse,
      questionText,
    }: {
      assistantResponse: string;
      questionText: string;
    }) => {
      console.log("repeating", questionText);
      await speak(
        assistantResponse + ": " + questionText,
        () => stopMic(),
        () => resumeMic(),
      );
    };

    const handleHintExhausted = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      await speak(
        assistantResponse,
        () => stopMic(),
        () => resumeMic(),
      );
    };

    const handleUnknown = async ({
      assistantResponse,
    }: {
      assistantResponse: string;
    }) => {
      await speak(
        assistantResponse,
        () => stopMic(),
        () => resumeMic(),
      );
    };

    socket.on("session-started", onSessionStarted);
    socket.on("hint", onHint);
    socket.on("skip", onSkip);
    socket.on("skip-failed", onSkipFailed);
    socket.on("answer-result", onAnswerResult);
    socket.on("next-question", onNextQuestion);
    socket.on("score-update", onScoreUpdate);
    socket.on("session-ended", onSessionEnded);
    socket.on("stop-trivia", handleStopEarly);
    socket.on("hint-exhausted", handleHintExhausted);
    socket.on("repeat", handleRepeat);
    socket.on("unknown", handleUnknown);

    return () => {
      socket.off("session-started", onSessionStarted);
      socket.off("hint", onHint);
      socket.off("skip", onSkip);
      socket.off("skip-failed", onSkipFailed);
      socket.off("answer-result", onAnswerResult);
      socket.off("next-question", onNextQuestion);
      socket.off("score-update", onScoreUpdate);
      socket.off("session-ended", onSessionEnded);
      socket.off("stop-trivia", handleStopEarly);
      socket.off("hint-exhausted", handleHintExhausted);
      socket.off("repeat", handleRepeat);
      socket.off("unknown", handleUnknown);
    };
  }, [started]);
}
