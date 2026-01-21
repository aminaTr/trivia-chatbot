import * as sessionService from "../services/session.service.js";

export const startSession = async (req, res) => {
  const session = await sessionService.createSession();
  res.json(session);
};
