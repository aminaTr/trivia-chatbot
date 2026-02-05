import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Evaluate user's answer with full trivia context
 * @param {string} question - Current question
 * @param {string} correctAnswer
 * @param {string} userAnswer
 * @param {Array} context - Array of previous questions with user answers
 */
export async function evaluateAnswerGroq(
  question,
  correctAnswer,
  userAnswer,
  context = [],
) {
  try {
    // Build context string
    const contextText = context
      .map(
        (q, i) =>
          `Q${i + 1}: "${q.question}" | Correct: "${q.correctAnswer}" | User: "${q.userAnswer}" | Assistant: "${q.assistantResponse || ""}"`,
      )
      .join("\n");

    const prompt = `
You are a trivia assistant who grades answers in a fun and natural way.
You have the following session context:
${contextText}

Now evaluate the current question:

Question: "${question}"
Correct Answer: "${correctAnswer}"
User Answer: "${userAnswer}"

Rules:
- Ignore capitalization, minor typos, or punctuation.
- Consider synonyms or variations.
- Provide a quirky, fun response to the user with intonation so rime ai can provide better tts.
- Respond in STRICT JSON:
  { "isCorrect": true, "assistantResponse": "quirky assistant reply" } 
  or 
  { "isCorrect": false, "assistantResponse": "quirky assistant reply" }
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Empty Groq response");

    const json = JSON.parse(text);
    return {
      isCorrect: !!json.isCorrect,
      assistantResponse: json.assistantResponse,
    };
  } catch (err) {
    console.error("Groq evaluation failed:", err);
    // Fallback: strict equality
    return {
      isCorrect: correctAnswer.toLowerCase() === userAnswer.toLowerCase(),
      assistantResponse: "",
    };
  }
}
