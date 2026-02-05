import { synthesizeSpeech } from "../services/rime.service.js";

export async function rimeTTSController(req, res) {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const audioBuffer = await synthesizeSpeech(text);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Rime TTS error:", err);
    res.status(500).json({ error: "TTS failed" });
  }
}
