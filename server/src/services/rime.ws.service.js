import WebSocket from "ws";

const activeConnections = new Map();

export function generateSpeechStream(text, socket) {
  const existingWs = activeConnections.get(socket.id);
  if (existingWs && existingWs.readyState === WebSocket.OPEN) {
    console.log("⚠️ Closing previous TTS connection");
    existingWs.close();
  }

  return new Promise((resolve, reject) => {
    // ✅ Clean the text before sending to TTS
    const cleanText = text
      // Normalize fancy dashes → hyphen
      .replace(/[–—]/g, "-")

      // Normalize smart apostrophes → straight apostrophe
      .replace(/[’‘]/g, "'")

      // Remove everything except ASCII + hyphen + apostrophe
      .replace(/[^\x00-\x7F'-]/g, "")

      // Remove markdown artifacts
      .replace(/\*+/g, "")

      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      console.warn("⚠️ Empty text after cleaning, skipping TTS");
      socket.emit("tts-audio-end");
      resolve();
      return;
    }

    console.log("📝 Original:", text);
    console.log("🧹 Cleaned:", cleanText);

    const ws = new WebSocket(
      "wss://users.rime.ai/ws?speaker=astra&modelId=arcana&audioFormat=pcm&samplingRate=24000",
      {
        headers: {
          Authorization: `Bearer ${process.env.RIME_API_KEY}`,
        },
      },
    );

    activeConnections.set(socket.id, ws);

    const BUFFER_SIZE = 9600;
    let audioBuffer = Buffer.alloc(0);
    let isClosed = false;
    let silenceTimer = null;
    let eosReceived = false;
    let consecutiveSilenceChunks = 0;

    function isSilence(buffer, threshold = 500) {
      if (buffer.length < 2) return true;

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 2) {
        const sample = buffer.readInt16LE(i);
        sum += Math.abs(sample);
      }

      const avgAmplitude = sum / (buffer.length / 2);
      return avgAmplitude < threshold;
    }

    function trimTrailingSilence(buffer, threshold = 500) {
      if (buffer.length < 2) return buffer;

      let lastNonSilent = buffer.length;

      for (let i = buffer.length - 200; i >= 0; i -= 200) {
        const chunk = buffer.subarray(i, i + 200);
        if (!isSilence(chunk, threshold)) {
          lastNonSilent = i + 200;
          break;
        }
      }

      return buffer.subarray(0, lastNonSilent);
    }

    function sendChunk(data, skipSilenceCheck = false) {
      if (!data || data.length === 0) return 0;

      const frameSize = 2;
      const alignedLength = Math.floor(data.length / frameSize) * frameSize;

      if (alignedLength === 0) return 0;

      const alignedData = data.subarray(0, alignedLength);

      if (!skipSilenceCheck && eosReceived && isSilence(alignedData)) {
        consecutiveSilenceChunks++;
        console.log(`🔇 Skipping silence chunk (${consecutiveSilenceChunks})`);

        if (consecutiveSilenceChunks >= 3) {
          console.log("🔇 Multiple silence chunks detected - ending");
          flushAndEnd();
          return alignedLength;
        }
        return alignedLength;
      }

      if (!isSilence(alignedData)) {
        consecutiveSilenceChunks = 0;
      }

      socket.emit(
        "tts-audio",
        alignedData.buffer.slice(
          alignedData.byteOffset,
          alignedData.byteOffset + alignedData.byteLength,
        ),
      );

      return alignedLength;
    }

    function flushAndEnd() {
      if (isClosed) return;
      isClosed = true;

      if (silenceTimer) clearTimeout(silenceTimer);

      if (audioBuffer.length >= 2) {
        const trimmed = trimTrailingSilence(audioBuffer, 300);
        if (trimmed.length >= 2) {
          sendChunk(trimmed, true);
        }
      }

      audioBuffer = Buffer.alloc(0);
      socket.emit("tts-audio-end");
      console.log("✅ TTS complete");

      if (activeConnections.get(socket.id) === ws) {
        activeConnections.delete(socket.id);
      }

      try {
        ws.close();
      } catch {}
      resolve();
    }

    ws.on("open", () => {
      console.log("🔊 Started TTS");
      ws.send(cleanText); // ✅ Send cleaned text
      ws.send("<EOS>");
      console.log("📤 Sent EOS token");
    });

    ws.on("message", (data) => {
      if (isClosed) return;

      if (!Buffer.isBuffer(data)) {
        const msg = data.toString();
        if (msg.includes("EOS") || msg.includes("end")) {
          eosReceived = true;
          console.log("🔚 EOS acknowledged by Rime");
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = setTimeout(flushAndEnd, 150);
        }
        return;
      }

      audioBuffer = Buffer.concat([audioBuffer, data]);

      while (audioBuffer.length >= BUFFER_SIZE) {
        const sent = sendChunk(audioBuffer.subarray(0, BUFFER_SIZE));
        audioBuffer = audioBuffer.subarray(sent || BUFFER_SIZE);
      }

      if (silenceTimer) clearTimeout(silenceTimer);

      const timeout = eosReceived ? 150 : 500;
      silenceTimer = setTimeout(flushAndEnd, timeout);
    });

    ws.on("close", () => {
      console.log("🔌 Rime closed connection");
      if (!isClosed) flushAndEnd();
    });

    ws.on("error", (err) => {
      if (isClosed) return;
      isClosed = true;

      if (silenceTimer) clearTimeout(silenceTimer);
      if (activeConnections.get(socket.id) === ws) {
        activeConnections.delete(socket.id);
      }

      socket.emit("tts-audio-end");
      console.error("❌ TTS error:", err.message);
      reject(err);
    });

    setTimeout(() => {
      if (!isClosed) {
        console.warn("⏱️ TTS timeout - forcing end");
        flushAndEnd();
      }
    }, 30000);
  });
}
export function cleanupTTS(socketId) {
  const ws = activeConnections.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`🧹 Cleaning up TTS for socket ${socketId}`);
    ws.close();
    activeConnections.delete(socketId);
  }
}
