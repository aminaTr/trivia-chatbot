import { useRef } from "react";
export const useMicSetup = (
  isListeningRef: React.RefObject<Boolean>,
  socket: any,
) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---------------- MIC CONTROLS ---------------- */
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      await audioContextRef.current.audioWorklet.addModule("/pcm-processor.js");

      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream);

      workletRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "pcm-processor",
      );

      workletRef.current.port.onmessage = (e) => {
        const pcm = new Int16Array(e.data);
        socket.emit("audio-chunk", pcm.buffer);
      };

      sourceRef.current.connect(workletRef.current);
      workletRef.current.connect(audioContextRef.current.destination);

      console.log("🎤 Mic streaming started (AudioWorklet)");
    } catch (err) {
      console.error("Mic error:", err);
    }
  };
  const stopMic = () => {
    isListeningRef.current = false;

    workletRef.current?.disconnect();
    workletRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    console.log("⏸️ Mic stopped");
  };
  const resumeMic = () => {
    isListeningRef.current = true;

    if (!audioContextRef.current) {
      startMic();
    } else if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
      console.log("▶️ Mic resumed");
    }
  };
  return { startMic, resumeMic, stopMic };
};
