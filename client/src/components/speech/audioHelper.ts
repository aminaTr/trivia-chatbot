// audioHelper.ts

// 🔒 internal state
let pendingSources = 0;
let lastChunkReceived = false;

export function markTTSStreamEnded() {
  lastChunkReceived = true;
  console.log("last chunk marked");
}

let audioContext: AudioContext | null = null;
let nextStartTime = 0;
function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 24000 });
  }
  return audioContext;
}

let onPlaybackEnded: (() => void) | null = null;

export function setOnPlaybackEnded(cb: () => void) {
  onPlaybackEnded = cb;
}

export async function playChunk(arrayBuffer: ArrayBuffer): Promise<void> {
  const ctx = getAudioContext();

  if (ctx.state === "suspended") await ctx.resume();
  if (arrayBuffer.byteLength === 0) return;

  let byteLength = arrayBuffer.byteLength;
  if (byteLength % 2 !== 0) byteLength--;

  if (byteLength === 0) return;

  const pcm16 = new Int16Array(arrayBuffer, 0, byteLength / 2);
  const float32 = new Float32Array(pcm16.length);

  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }

  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  pendingSources++;

  source.onended = () => {
    pendingSources--;

    console.log("🔊 audio chunk finished");

    if (lastChunkReceived && pendingSources === 0) {
      console.log("🏁 All audio fully played");
      onPlaybackEnded?.(); // ✅ local signal
      lastChunkReceived = false;
    }
  };

  const now = ctx.currentTime;
  if (nextStartTime < now) nextStartTime = now;

  source.start(nextStartTime);
  nextStartTime += buffer.duration;
}

export function resetAudioTiming() {
  nextStartTime = 0;
  console.log("⏹️ Audio timing reset");
}

export function closeAudioContext() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    nextStartTime = 0;
    console.log("🔌 Audio context closed");
  }
}
