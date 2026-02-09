import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const dgConnections = new Map();

export function registerDeepgramSTT(socket) {
  socket.on("stt-start", async () => {
    if (dgConnections.has(socket.id)) {
      console.log("⚠️ Connection already exists for", socket.id);
      return;
    }

    try {
      console.log("🔧 Creating Deepgram connection for", socket.id);

      // Correct way to create connection
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        encoding: "linear16",
        sample_rate: 16000,
        channels: 1,
        interim_results: true,
        punctuate: true,
        smart_format: true,
      });

      dgConnections.set(socket.id, connection);

      // Use LiveTranscriptionEvents enum
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("✅ Deepgram connection OPENED for", socket.id);
      });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        console.log("📥 TRANSCRIPT EVENT:", JSON.stringify(data, null, 2));

        const transcript = data.channel?.alternatives?.[0]?.transcript;

        if (transcript && transcript.trim()) {
          console.log("✅ Transcript:", transcript);

          socket.emit("stt-transcript", {
            text: transcript,
            isFinal: data.is_final ?? false,
            speechFinal: data.speech_final ?? false,
          });
        }
      });

      connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log("🧠 Metadata:", data);
      });

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("❌ Deepgram error:", error);
      });

      connection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.warn("⚠️ Warning:", warning);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("🔌 Deepgram closed for", socket.id);
        dgConnections.delete(socket.id);
      });

      connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        console.log("🎤 Utterance ended");
      });

      console.log("🎙️ Deepgram connection setup complete for", socket.id);
    } catch (error) {
      console.error("❌ Failed to create Deepgram connection:", error);
      dgConnections.delete(socket.id);
    }
  });

  socket.on("audio-chunk", (arrayBuffer) => {
    const connection = dgConnections.get(socket.id);
    if (!connection) {
      return;
    }

    try {
      const buffer = Buffer.from(arrayBuffer);
      connection.send(buffer);
    } catch (err) {
      console.error("❌ Error sending audio:", err);
    }
  });

  socket.on("stt-stop", () => {
    const connection = dgConnections.get(socket.id);
    if (connection) {
      connection.finish();
      dgConnections.delete(socket.id);
      console.log("🛑 STT stopped for", socket.id);
    }
  });

  socket.on("disconnect", () => {
    const connection = dgConnections.get(socket.id);
    if (connection) {
      connection.finish();
      dgConnections.delete(socket.id);
      console.log("👋 Cleaned up connection for", socket.id);
    }
  });
}
