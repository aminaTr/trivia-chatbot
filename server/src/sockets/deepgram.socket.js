import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { voiceState } from "../services/state/voice.server.state.js";
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// socket.id → deepgram connection
const dgConnections = new Map();

// socket.id → audio buffer queue
const audioQueues = new Map();

// socket.id → keep alive queue
const keepAliveIntervals = new Map();

const speechFinalCooldowns = new Map(); // socketId → timestamp <string, number>

const FRAME_MS = 64; // 1024 samples @ 16kHz

/* ---------------- REAL-TIME PACER (GLOBAL, ONCE) ---------------- */
setInterval(() => {
  for (const [socketId, connection] of dgConnections.entries()) {
    const queue = audioQueues.get(socketId);
    if (!queue || queue.length === 0) continue;

    const frame = queue.shift();
    try {
      connection.send(frame);
    } catch (err) {
      console.error("❌ Deepgram send failed:", err);
    }
  }
}, FRAME_MS);

/* ---------------- SOCKET REGISTRATION ---------------- */
export function registerDeepgramSTT(socket) {
  /* -------- START STT -------- */
  socket.on("stt-start", () => {
    // Prevent duplicate connections
    if (dgConnections.has(socket.id)) {
      console.log("⚠️ STT already active for", socket.id);
      return;
    }

    console.log("🎙️ Creating Deepgram connection for", socket.id);

    const connection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
      interim_results: true,
      punctuate: true,
      smart_format: true,
      vad_events: true,
      endpointing: 200,
    });

    dgConnections.set(socket.id, connection);
    audioQueues.set(socket.id, []);
    const keepAlive = setInterval(() => {
      try {
        connection.keepAlive();
      } catch (err) {
        console.error("KeepAlive failed:", err);
      }
    }, 3000);

    keepAliveIntervals.set(socket.id, keepAlive);

    /* -------- EVENTS -------- */
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log("✅ Deepgram OPEN for", socket.id);
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript?.trim();
      if (!transcript) return;
      const socketId = socket.id;
      const currentState = voiceState.get(socketId);

      // 🚫 Only allow transcripts while LISTENING
      if (currentState !== "LISTENING") {
        console.log("❌ Ignored due to state:", currentState, transcript);
        return;
      }

      // const now = Date.now();
      // const lastCooldown = speechFinalCooldowns.get(socket.id) || 0;
      // const COOLDOWN_MS = 5000; // adjust as needed

      // // If we're in cooldown after last speech_final, ignore this chunk
      // if (now - lastCooldown < COOLDOWN_MS) {
      //   console.log("❌ Ignoring chunk due to cooldown", transcript);
      //   return;
      // } else {
      //   console.log(
      //     "now - lastCooldown < COOLDOWN_MS",
      //     now,
      //     lastCooldown,
      //     transcript,
      //   );
      // }

      // console.log("data.speech_final", data.speech_final);

      socket.emit("stt-transcript", {
        text: transcript,
        isFinal: data.is_final ?? false,
        speechFinal: data.speech_final ?? false,
      });

      if (data.speech_final) {
        socket.emit("user-finished-speaking");
        console.log("🛑 Transition → UTTERANCE_COMPLETE");

        voiceState.set(socketId, "UTTERANCE_COMPLETE");
        // start cooldown
        // speechFinalCooldowns.set(socket.id, now);
      }
    });

    connection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log("🧠 Metadata:", data);
    });

    connection.on(LiveTranscriptionEvents.Warning, (warning) => {
      console.warn("⚠️ Deepgram warning:", warning);
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error("❌ Deepgram error:", error);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log("🔌 Deepgram closed for", socket.id);

      dgConnections.delete(socket.id);
      audioQueues.delete(socket.id);
      clearInterval(keepAliveIntervals.get(socket.id));
      keepAliveIntervals.delete(socket.id);

      // AUTO RESTART
      // socket.emit("stt-restart");
    });

    connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log("🎤 Utterance ended for", socket.id);
    });
  });

  /* -------- AUDIO INGEST -------- */
  socket.on("audio-chunk", (arrayBuffer) => {
    const queue = audioQueues.get(socket.id);
    if (!queue) return;
    queue.push(Buffer.from(arrayBuffer));
  });

  /* -------- STOP STT -------- */
  socket.on("stt-stop", () => {
    const connection = dgConnections.get(socket.id);
    if (!connection) return;

    console.log("🛑 STT stopped for", socket.id);
    connection.finish();
    dgConnections.delete(socket.id);
    audioQueues.delete(socket.id);
    clearInterval(keepAliveIntervals.get(socket.id));
    keepAliveIntervals.delete(socket.id);
  });

  /* -------- DISCONNECT -------- */
  socket.on("disconnect", () => {
    const connection = dgConnections.get(socket.id);
    if (!connection) return;

    console.log("👋 Socket disconnected:", socket.id);
    connection.finish();
    dgConnections.delete(socket.id);
    audioQueues.delete(socket.id);
    clearInterval(keepAliveIntervals.get(socket.id));
    keepAliveIntervals.delete(socket.id);
  });
}
