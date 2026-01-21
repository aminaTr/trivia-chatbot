import TriviaSession from "../models/TriviaSession.js";
import generateSessionId from "../utils/generateSessionId.js";

export const createSession = async () => {
  return TriviaSession.create({
    sessionId: generateSessionId(),
  });
};
