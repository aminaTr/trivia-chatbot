// // audioHelper.ts

// // 🔒 internal state
// let pendingSources = 0;
// let lastChunkReceived = false;

// export function markTTSStreamEnded() {
//   lastChunkReceived = true;
//   console.log("last chunk marked");
// }

// let audioContext: AudioContext | null = null;
// let nextStartTime = 0;
// function getAudioContext() {
//   if (!audioContext) {
//     audioContext = new AudioContext({ sampleRate: 48000 });
//   }
//   return audioContext;
// }

// let onPlaybackEnded: (() => void) | null = null;

// export function setOnPlaybackEnded(cb: () => void) {
//   onPlaybackEnded = cb;
// }

// // export async function playChunk(arrayBuffer: ArrayBuffer): Promise<void> {
// //   const ctx = getAudioContext();
// //   if (ctx.state === "suspended") await ctx.resume();
// //   if (arrayBuffer.byteLength === 0) return;
// //   let byteLength = arrayBuffer.byteLength;
// //   if (byteLength % 2 !== 0) byteLength--;
// //   if (byteLength === 0) return;
// //   const pcm16 = new Int16Array(arrayBuffer, 0, byteLength / 2);
// //   const float32 = new Float32Array(pcm16.length);
// //   for (let i = 0; i < pcm16.length; i++) {
// //     float32[i] = (pcm16[i] / 32768) * 0.95;
// //   }
// //   const buffer = ctx.createBuffer(1, float32.length, 48000);
// //   buffer.copyToChannel(float32, 0);
// //   const source = ctx.createBufferSource();
// //   source.buffer = buffer;
// //   const now = ctx.currentTime;
// //   // const startTime = Math.max(nextStartTime, now + 0.01);
// //   if (nextStartTime === 0 || nextStartTime < now) {
// //     nextStartTime = now + 0.1; // 100ms safety buffer
// //   }

// //   const startTime = nextStartTime;

// //   const endTime = startTime + buffer.duration;
// //   const gainNode = ctx.createGain();
// //   if (pendingSources === 0) {
// //     gainNode.gain.setValueAtTime(0, startTime);
// //     gainNode.gain.linearRampToValueAtTime(1, startTime + 0.005);
// //   } else {
// //     gainNode.gain.setValueAtTime(1, startTime);
// //   }
// //   if (lastChunkReceived) {
// //     gainNode.gain.setValueAtTime(1, endTime - 0.005);
// //     gainNode.gain.linearRampToValueAtTime(0, endTime);
// //   }
// //   source.connect(gainNode);
// //   gainNode.connect(ctx.destination);
// //   source.start(startTime);
// //   nextStartTime = endTime;
// //   pendingSources++;
// //   source.onended = () => {
// //     pendingSources--;
// //     console.log("🔊 audio chunk finished");
// //     if (lastChunkReceived && pendingSources === 0) {
// //       console.log("🏁 All audio fully played");
// //       onPlaybackEnded?.(); // ✅ local signal
// //       lastChunkReceived = false;
// //     }
// //   };
// // }

// export async function playChunk(arrayBuffer: ArrayBuffer): Promise<void> {
//   const ctx = getAudioContext();
//   if (ctx.state === "suspended") await ctx.resume();
//   if (!arrayBuffer || arrayBuffer.byteLength < 2) return;

//   let byteLength = arrayBuffer.byteLength;
//   const samples = byteLength / 2;
//   const durationMs = (samples / 48000) * 1000;

//   console.log("Chunk bytes:", byteLength);
//   console.log("Chunk duration (ms):", durationMs.toFixed(2));

//   if (byteLength % 2 !== 0) byteLength--;
//   if (byteLength <= 0) return;

//   const pcm16 = new Int16Array(arrayBuffer, 0, byteLength / 2);
//   const float32 = new Float32Array(pcm16.length);

//   for (let i = 0; i < pcm16.length; i++) {
//     float32[i] = pcm16[i] / 32768;
//   }

//   const buffer = ctx.createBuffer(1, float32.length, ctx.sampleRate);
//   buffer.copyToChannel(float32, 0);

//   const source = ctx.createBufferSource();
//   const gainNode = ctx.createGain();

//   source.buffer = buffer;
//   source.connect(gainNode);
//   gainNode.connect(ctx.destination);

//   const now = ctx.currentTime;

//   // --- underrun detection ---
//   const UNDERRUN_THRESHOLD = 0.03; // 30ms

//   if (nextStartTime === 0) {
//     // first chunk
//     nextStartTime = now + 0.05;
//   }

//   if (nextStartTime < now - UNDERRUN_THRESHOLD) {
//     console.warn("⚠️ Audio underrun detected — resyncing timeline");
//     nextStartTime = now + 0.05;
//   }

//   const startTime = nextStartTime;
//   const endTime = startTime + buffer.duration;

//   // minimal fade to prevent clicks
//   const fade = 0.003;

//   gainNode.gain.setValueAtTime(0, startTime);
//   gainNode.gain.linearRampToValueAtTime(1, startTime + fade);

//   if (lastChunkReceived) {
//     gainNode.gain.setValueAtTime(1, endTime - fade);
//     gainNode.gain.linearRampToValueAtTime(0, endTime);
//   }

//   source.start(startTime);

//   nextStartTime = endTime;
//   pendingSources++;

//   source.onended = () => {
//     pendingSources--;

//     if (lastChunkReceived && pendingSources === 0) {
//       onPlaybackEnded?.();
//       lastChunkReceived = false;
//       nextStartTime = 0;
//     }
//   };
// }

// export function resetAudioTiming() {
//   nextStartTime = getAudioContext().currentTime + 0.02; // 20ms buffer
//   console.log("⏹️ Audio timing reset");
// }

// export function closeAudioContext() {
//   if (audioContext) {
//     audioContext.close();
//     audioContext = null;
//     nextStartTime = 0;
//     console.log("🔌 Audio context closed");
//   }
// }

// audioHelper.ts
let audioContext: AudioContext | null = null;
let nextStartTime = 0;
let pendingSources = 0;
let lastChunkReceived = false;
let onPlaybackEnded: (() => void) | null = null;

// buffer queue for smooth playback
const chunkQueue: ArrayBuffer[] = [];
const BUFFER_CHUNKS = 3; // number of chunks to buffer before playback

export function setOnPlaybackEnded(cb: () => void) {
  onPlaybackEnded = cb;
}

export function markTTSStreamEnded() {
  lastChunkReceived = true;
  console.log("last chunk marked");
}

function getAudioContext() {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export function resetAudioTiming() {
  nextStartTime = getAudioContext().currentTime + 0.02; // small safety buffer
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

// convert PCM16 → Float32
function pcm16ToFloat32(pcm16: Int16Array) {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = (pcm16[i] / 32768) * 0.95;
  }
  return float32;
}

// main play logic
async function playFloat32Chunk(float32: Float32Array) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  // float32: Float32Array<ArrayBuffer | SharedArrayBuffer>
  const bufferData = new Float32Array(float32.length);

  const buffer = ctx.createBuffer(1, bufferData.length, 48000);

  // Copy all values to a new Float32Array backed by a real ArrayBuffer
  bufferData.set(float32);

  buffer.copyToChannel(bufferData, 0); // ✅ now type is correct

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const now = ctx.currentTime;
  if (nextStartTime < now + 0.02) nextStartTime = now + 0.02; // 20ms safety

  const startTime = nextStartTime;
  const endTime = startTime + buffer.duration;

  const gainNode = ctx.createGain();
  if (pendingSources === 0) {
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + 0.005);
  } else {
    gainNode.gain.setValueAtTime(1, startTime);
  }

  if (lastChunkReceived) {
    gainNode.gain.setValueAtTime(1, endTime - 0.005);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
  }

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(startTime);
  nextStartTime = endTime;
  pendingSources++;

  source.onended = () => {
    pendingSources--;
    if (lastChunkReceived && pendingSources === 0) {
      onPlaybackEnded?.();
      lastChunkReceived = false;
      console.log("🏁 All audio fully played");
    }
  };
}

// queue + buffer handler
export async function playChunk(arrayBuffer: ArrayBuffer) {
  if (arrayBuffer.byteLength === 0) return;

  // ensure even bytes
  let byteLength = arrayBuffer.byteLength;
  if (byteLength % 2 !== 0) byteLength--;
  if (byteLength === 0) return;

  chunkQueue.push(arrayBuffer);

  // only start playback once we have BUFFER_CHUNKS or last chunk
  while (
    chunkQueue.length >= BUFFER_CHUNKS ||
    (lastChunkReceived && chunkQueue.length > 0)
  ) {
    const chunk = chunkQueue.shift()!;
    const pcm16 = new Int16Array(chunk, 0, chunk.byteLength / 2);
    const float32 = pcm16ToFloat32(pcm16);
    await playFloat32Chunk(float32);
  }
}
