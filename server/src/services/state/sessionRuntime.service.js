// sessionRuntime.js

/**
 * Map<sessionId, {
 *   currentQuestionIndex: number,
 *   questions
 *   skips: number
 *   skipped: number
 * }>
 */
const sessionRuntime = new Map();

/**
 * Initialize runtime state when session starts
 */
export function initSessionRuntime(sessionId, questions, skips, skipped = 0) {
  if (!questions?.length) {
    throw new Error("No questions provided to initSessionRuntime");
  }

  sessionRuntime.set(sessionId, {
    currentQuestionIndex: 0,
    questions,
    skips,
    skipped,
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
export function advanceQuestion(sessionId) {
  const state = sessionRuntime.get(sessionId);
  if (!state) return null;

  const totalQuestions = state.questions.length;
  const effectiveTotal = totalQuestions - state.skips;
  const answeredCount = state.currentQuestionIndex + 1 - state.skipped;
  const nextIndex = state.currentQuestionIndex + 1;

  if (answeredCount >= effectiveTotal) {
    sessionRuntime.delete(sessionId);
    return null; // session completed
  }
  state.currentQuestionIndex = nextIndex;

  return state;
}

export function skipQuestion(sessionId) {
  const state = getRuntime(sessionId);
  state.skipped += 1;
  return advanceQuestion(sessionId);
}

/**
 * Clear runtime (on abandon / disconnect)
 */
export function clearRuntime(sessionId) {
  sessionRuntime.delete(sessionId);
}

export function getCurrentQuestionId(sessionId) {
  const state = getRuntime(sessionId);
  return state.questions[state.currentQuestionIndex]._id.toString();
}

export function getCurrentQuestionText(sessionId) {
  const state = getRuntime(sessionId);
  return state.questions[state.currentQuestionIndex].question;
}
