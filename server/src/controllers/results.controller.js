import { getSummary } from "../services/results.service.js";

export async function summarizeResults(req, res) {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "SessionId is required" });
  }

  try {
    const response = await getSummary(sessionId);
    return res.send(response, 200);
    // return res.json(response, 200);
  } catch (err) {
    console.error("Fetch results summary:", err);
    return res.status(500).json({ error: "Summarization failed" });
  }
}
