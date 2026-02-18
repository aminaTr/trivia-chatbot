import * as sessionService from "../services/session.service.js";

export const startSession = async (req, res) => {
  const session = await sessionService.startTriviaSession();
  res.json(session);
};
