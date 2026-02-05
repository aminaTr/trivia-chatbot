// audioHelper.ts
// let pcmRemainder: Uint8Array | null = null;
// let audioContext: AudioContext | null = null;

// function getAudioContext() {
//   if (!audioContext) {
//     audioContext = new AudioContext();
//   }
//   return audioContext;
// }

// // PCM configuration from Rime (16-bit, mono, 24kHz based on common defaults)
// const SAMPLE_RATE = 24000; // Adjust if Rime uses different rate
// const NUM_CHANNELS = 1;
// const BYTES_PER_SAMPLE = 2; // 16-bit = 2 bytes

// export async function playChunk(
//   arrayBuffer: ArrayBuffer,
// ): Promise<AudioBufferSourceNode> {
//   const ctx = getAudioContext();

//   // Resume context if suspended
//   if (ctx.state === "suspended") {
//     await ctx.resume();
//   }

//   // Convert raw PCM to AudioBuffer
//   const numSamples = arrayBuffer.byteLength / BYTES_PER_SAMPLE;
//   const audioBuffer = ctx.createBuffer(NUM_CHANNELS, numSamples, SAMPLE_RATE);

//   // Read PCM data as 16-bit signed integers
//   const pcmData = new Int16Array(arrayBuffer);
//   const channelData = audioBuffer.getChannelData(0);

//   // Convert from Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
//   for (let i = 0; i < numSamples; i++) {
//     channelData[i] = pcmData[i] / 32768.0;
//   }

//   // Create and configure source
//   const source = ctx.createBufferSource();
//   source.buffer = audioBuffer;
//   source.connect(ctx.destination);

//   // Schedule playback to avoid gaps
//   const currentTime = ctx.currentTime;
//   if (nextStartTime < currentTime) {
//     nextStartTime = currentTime;
//   }

//   source.start(nextStartTime);
//   nextStartTime += audioBuffer.duration;

//   return source;
// }

// let pcmRemainder: Uint8Array | null = null;
// let audioContext: AudioContext | null = null;

// function getAudioContext() {
//   if (!audioContext) {
//     audioContext = new AudioContext();
//   }
//   return audioContext;
// }

// // PCM configuration from Rime (16-bit, mono, 24kHz based on common defaults)
// const SAMPLE_RATE = 24000; // Adjust if Rime uses different rate
// const NUM_CHANNELS = 1;
// const BYTES_PER_SAMPLE = 2; // 16-bit = 2 bytes

// export async function playChunk(
//   arrayBuffer: ArrayBuffer,
// ): Promise<AudioBufferSourceNode | null> {
//   const ctx = getAudioContext();

//   if (ctx.state === "suspended") {
//     await ctx.resume();
//   }

//   let data = new Uint8Array(arrayBuffer);

//   // 🔹 If we have leftover bytes from last chunk, prepend them
//   if (pcmRemainder) {
//     const combined = new Uint8Array(pcmRemainder.length + data.length);
//     combined.set(pcmRemainder, 0);
//     combined.set(data, pcmRemainder.length);
//     data = combined;
//     pcmRemainder = null;
//   }

//   // 🔹 If byte length is odd, save last byte for next chunk
//   if (data.byteLength % 2 !== 0) {
//     pcmRemainder = data.slice(data.byteLength - 1);
//     data = data.slice(0, data.byteLength - 1);
//   }

//   // Nothing to play yet
//   if (data.byteLength === 0) return null;

//   const pcm16 = new Int16Array(
//     data.buffer,
//     data.byteOffset,
//     data.byteLength / 2,
//   );

//   const audioBuffer = ctx.createBuffer(NUM_CHANNELS, pcm16.length, SAMPLE_RATE);

//   const channelData = audioBuffer.getChannelData(0);

//   for (let i = 0; i < pcm16.length; i++) {
//     channelData[i] = pcm16[i] / 32768;
//   }

//   const source = ctx.createBufferSource();
//   source.buffer = audioBuffer;
//   source.connect(ctx.destination);

//   const currentTime = ctx.currentTime;
//   if (nextStartTime < currentTime) {
//     nextStartTime = currentTime;
//   }

//   source.start(nextStartTime);
//   nextStartTime += audioBuffer.duration;

//   return source;
// }

// export function resetAudioTiming() {
//   nextStartTime = 0;
//   pcmRemainder = null; // 🔥 important
// }

// export function closeAudioContext() {
//   if (audioContext) {
//     audioContext.close();
//     audioContext = null;
//   }
// }
// let nextStartTime = 0;
// const MIN_CHUNK_BYTES = 256; // ignore tiny noise chunks

// let chunkBuffer: Uint8Array[] = [];
// let chunkBufferLength = 0;

// export function playPCMChunk(chunk: ArrayBuffer, sampleRate = 24000) {
//   if (chunk.byteLength < MIN_CHUNK_BYTES) return; // skip tiny noise

//   const data = new Uint8Array(chunk);
//   chunkBuffer.push(data);
//   chunkBufferLength += data.length;

//   // Optional: flush buffer every 1024 bytes or at end
//   if (chunkBufferLength >= 1024) {
//     flushChunks(sampleRate);
//   }
// }

// export function flushChunks(sampleRate = 24000) {
//   if (chunkBufferLength === 0) return;

//   const combined = new Uint8Array(chunkBufferLength);
//   let offset = 0;
//   for (const c of chunkBuffer) {
//     combined.set(c, offset);
//     offset += c.length;
//   }

//   chunkBuffer = [];
//   chunkBufferLength = 0;

//   const int16 = new Int16Array(combined.buffer);
//   const float32 = new Float32Array(int16.length);
//   for (let i = 0; i < int16.length; i++) {
//     float32[i] = int16[i] / 32768;
//   }

//   const ctx = getAudioContext();
//   const buffer = ctx.createBuffer(1, float32.length, sampleRate);
//   buffer.copyToChannel(float32, 0);

//   const source = ctx.createBufferSource();
//   source.buffer = buffer;
//   source.connect(ctx.destination);

//   if (nextStartTime < ctx.currentTime) nextStartTime = ctx.currentTime;
//   source.start(nextStartTime);
//   nextStartTime += buffer.duration;
// }

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
