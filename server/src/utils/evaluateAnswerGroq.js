import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Evaluate user's answer using Groq GPT-OSS 120B
 * @param {string} question - Trivia question
 * @param {string} correctAnswer - Answer stored in DB
 * @param {string} userAnswer - Answer provided by user
 * @returns {boolean} isCorrect
 */
export async function evaluateAnswerGroq(question, correctAnswer, userAnswer) {
  try {
    const prompt = `
You are a trivia grader. Determine if the user's answer is correct.

Question: "${question}"
Correct Answer: "${correctAnswer}"
User Answer: "${userAnswer}"

Rules:
- Ignore capitalization.
- Ignore minor typos or punctuation.
- Consider synonyms or common variations.
- a quirky response to make the experience natural and more assistant like.
- Respond with STRICT JSON: { "isCorrect": true, "assistantResponse":"a quirky response" } or { "isCorrect": false, "assistantResponse":"a quirky response" }
`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
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
    return correctAnswer.toLowerCase() === userAnswer.toLowerCase();
  }
}
