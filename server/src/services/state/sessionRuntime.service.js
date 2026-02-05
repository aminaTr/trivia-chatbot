// sessionRuntime.js

/**
 * Map<sessionId, {
 *   currentQuestionIndex: number,
 *   currentQuestionId: string,
 *   currentQuestionText: string
 * }>
 */
const sessionRuntime = new Map();

/**
 * Initialize runtime state when session starts
 */
export function initSessionRuntime(sessionId, questions) {
  if (!questions?.length) {
    throw new Error("No questions provided to initSessionRuntime");
  }

  sessionRuntime.set(sessionId, {
    currentQuestionIndex: 0,
    currentQuestionId: questions[0]._id.toString(),
    currentQuestionText: questions[0].question,
  });
}

/**
 * Get runtime state
 */
export function getRuntime(sessionId) {
  return sessionRuntime.get(sessionId) || null;
}

/**
 * Move to next question
 */
export function advanceQuestion(sessionId, questions, nextQuestion) {
  const state = sessionRuntime.get(sessionId);
  if (!state) return null;

  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex >= questions.length) {
    sessionRuntime.delete(sessionId);
    return null; // session completed
  }

  state.currentQuestionIndex = nextIndex;
  state.currentQuestionId = questions[nextIndex].questionId._id.toString();
  state.currentQuestionText = nextQuestion;

  return state;
}

/**
 * Clear runtime (on abandon / disconnect)
 */
export function clearRuntime(sessionId) {
  sessionRuntime.delete(sessionId);
}
