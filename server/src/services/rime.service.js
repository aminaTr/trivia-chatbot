// services/rime.service.js

// Simple in-memory cache
// Key: text, Value: Buffer (mp3 audio)
const cache = new Map();

// Cache size limit to avoid memory bloat
const MAX_CACHE_SIZE = 100;

export async function synthesizeSpeech(text) {
  // Return cached audio if exists
  if (cache.has(text)) {
    return cache.get(text);
  }
  const response = await fetch("https://users.rime.ai/v1/rime-tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RIME_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "audio/mp3",
    },
    body: JSON.stringify({
      text: text,
      speaker: "astra",
      modelId: "arcana",
      audioFormat: "mp3",
    }),
  });
  if (!response.ok) {
    throw new Error(`Rime TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Store in cache
  cache.set(text, audioBuffer);

  // Simple cache cleaning (FIFO)
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  return audioBuffer;
}
