import { submitAnswer } from "./answer.service.js";
import { checkHint, getHint } from "./hint.service.js";
import { getQuestion } from "./question.service.js";
import { stopTriviaEarly } from "./session.service.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
/**
 * LLM-driven decision engine
 * Determines user intent and triggers the correct service
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.questionId
 * @param {string} params.userInput - Transcript from STT
 * @param {Array} params.context - Previous questions & answers for context
 */
export async function handleUserIntent({
  sessionId,
  questionId,
  userInput,
  context,
}) {
  const currentQuestion = await getQuestion(questionId);
  const hint = await checkHint({
    sessionId,
    questionId,
  });
  // Build LLM prompt to detect intent
  const intentPrompt = `
You are a trivia voice assistant.

CURRENT QUESTION:
"${currentQuestion.question}"

CORRECT ANSWER:
"${currentQuestion.acceptedAnswers.join(", ")}"

USER SAID:
"${userInput}"

Hint exhausted: ${hint.exhausted}

Decide the user's intent ONLY.
DO NOT judge correctness.

Intents:
- ANSWER → if user is attempting to answer the question (even if wrong)
- HINT → if asking for a hint and hint is NOT exhausted
- HINT-EXHAUSTED → if asking for a hint but hint IS exhausted
- SKIP → if they want to skip
- REPEAT → if they want the question repeated
- STOP → if they want to stop playing
- UNKNOWN → unclear

Rules:
- If the user says something that could reasonably be an answer, choose ANSWER
- Do NOT decide whether the answer is correct
- Do NOT repeat the question or answer
- assistantResponse should be a short facilitating line
- assistantResponse must NOT contain the question or answer
- assistantResponse must NOT contain dashes (-), asterisks (*), underscores (_), or any formatting characters
- assistantResponse should be plain text only, ready for TTS
- Output STRICT JSON ONLY

Respond as:
{
  "intent": "ANSWER|HINT|HINT-EXHAUSTED|SKIP|REPEAT|STOP|UNKNOWN",
  "assistantResponse": string | null
}
`;
  //  Call LLM (Groq / GPT-OSS)
  let llmResponse;
  try {
    const completion = await groq.chat.completions.create({
      // model: "openai/gpt-oss-120b",
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: intentPrompt }],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Empty LLM intent response");

    llmResponse = JSON.parse(text);
  } catch (err) {
    console.error("LLM intent parsing failed:", err);
    llmResponse = { intent: "UNKNOWN", answer: null };
  }

  // Execute service based on intent
  switch (llmResponse.intent) {
    case "ANSWER":
      return await submitAnswer({
        sessionId,
        questionId,
        answer: userInput,
      });

    case "HINT":
      return {
        ...(await getHint({
          sessionId,
          questionId,
        })),
        assistantResponse: llmResponse?.assistantResponse,
      };
    case "HINT-EXHAUSTED":
      return {
        hintExhausted: true,
        assistantResponse: llmResponse?.assistantResponse,
      }; // frontend will tell user

    case "SKIP":
      return {
        skipped: true,
        assistantResponse: llmResponse?.assistantResponse,
      }; // socket will fetch next question

    case "REPEAT":
      return {
        repeat: true,
        assistantResponse: llmResponse?.assistantResponse,
      }; // frontend will repeat question

    case "STOP":
      const stopped = await stopTriviaEarly({ sessionId });
      if (stopped) {
        return {
          stop: true,
          assistantResponse: llmResponse?.assistantResponse,
        }; // frontend will stop session
      }
      return {
        unknown: true,
        assistantResponse: "Unfortunately, some error has occured",
      };

    case "UNKNOWN":
    default:
      return {
        unknown: true,
        assistantResponse:
          llmResponse?.assistantResponse || "Sorry, I didn't understand that.",
      };
  }
}
