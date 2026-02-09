// import { getAudio } from "@/api/audio";
// import { useRef } from "react";
// import { startSpeaking, stopSpeaking, isSpeaking } from "./speechManager";

// export function useTTS(resetTranscript: () => void) {
//   const queueRef = useRef<(() => Promise<void>)[]>([]);
//   const isProcessingRef = useRef(false);

//   async function processQueue() {
//     if (isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     while (queueRef.current.length > 0) {
//       const task = queueRef.current.shift();
//       if (task) await task();
//     }

//     isProcessingRef.current = false;
//   }

//   function speak(text: string) {
//     return new Promise<void>((resolve) => {
//       const task = async () => {
//         startSpeaking();

//         try {
//           const { audio, audioUrl } = await getAudio(text);

//           await new Promise<void>((res) => {
//             audio.onended = audio.onerror = () => {
//               URL.revokeObjectURL(audioUrl);
//               stopSpeaking(resetTranscript);
//               res();
//             };

//             audio.play();
//           });
//         } catch {
//           stopSpeaking(resetTranscript);
//         }

//         resolve();
//       };

//       queueRef.current.push(task);
//       processQueue();
//     });
//   }

//   function stopSpeech() {
//     queueRef.current = []; // clear pending tasks
//     stopSpeaking(resetTranscript);
//   }

//   return { speak, stopSpeech, isSpeaking };
// }

// import { useRef } from "react";
// import { startSpeaking, stopSpeaking, isSpeaking } from "./speechManager";
// import { playChunk } from "./audioHelper";
// export function useTTS(socket: any, resetTranscript: () => void) {
//   const queueRef = useRef<(() => Promise<void>)[]>([]);
//   const isProcessingRef = useRef(false);

//   async function processQueue() {
//     if (isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     while (queueRef.current.length) {
//       const task = queueRef.current.shift();
//       if (task) await task();
//     }

//     isProcessingRef.current = false;
//   }

//   function speak(text: string) {
//     return new Promise<void>((resolve) => {
//       const task = async () => {
//         startSpeaking();

//         // Ask backend to start TTS
//         socket.emit("tts-start", { text });

//         const audioChunks: ArrayBuffer[] = [];

//         const onAudio = async ({
//           chunk,
//           isLast,
//         }: {
//           chunk?: ArrayBuffer;
//           isLast: boolean;
//         }) => {
//           if (chunk) {
//             audioChunks.push(chunk);
//             // Play the chunk immediately
//             await playChunk(chunk);
//           }

//           if (isLast) {
//             socket.off("tts-audio", onAudio);
//             stopSpeaking(resetTranscript);
//             resolve();
//           }
//         };

//         socket.on("tts-audio", onAudio);
//       };

//       queueRef.current.push(task);
//       processQueue();
//     });
//   }

//   function stopSpeech() {
//     queueRef.current = [];
//     socket.emit("tts-stop");
//     stopSpeaking(resetTranscript);
//   }

//   return { speak, stopSpeech, isSpeaking };
// }

// useTTS.ts
// import { useRef } from "react";
// import { startSpeaking, stopSpeaking, isSpeaking } from "./speechManager";
// import {
//   closeAudioContext,
//   flushChunks,
//   playPCMChunk,
//   resetAudioTiming,
// } from "./audioHelper";

// export function useTTS(socket: any, resetTranscript: () => void) {
//   const queueRef = useRef<(() => Promise<void>)[]>([]);
//   const isProcessingRef = useRef(false);
//   // const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

//   async function processQueue() {
//     if (isProcessingRef.current) return;
//     isProcessingRef.current = true;

//     while (queueRef.current.length) {
//       const task = queueRef.current.shift();
//       if (task) await task();
//     }

//     isProcessingRef.current = false;
//   }

//   function speak(text: string) {
//     return new Promise<void>((resolve) => {
//       const task = async () => {
//         startSpeaking();
//         socket.emit("tts-start", { text });

//         socket.off("tts-audio");

//         socket.on("tts-audio", (chunk: ArrayBuffer) => {
//           playPCMChunk(chunk);
//         });

//         socket.on("tts-audio-end", () => {
//           stopSpeaking(resetTranscript);
//           flushChunks(); // flush leftover PCM

//           resolve();
//         });
//       };

//       queueRef.current.push(task);
//       processQueue();
//     });
//   }
//   function stopSpeech() {
//     queueRef.current = [];

//     closeAudioContext();
//     resetAudioTiming();
//     socket.emit("tts-stop");
//     stopSpeaking(resetTranscript);
//   }

//   return { speak, stopSpeech, isSpeaking };
// }

import { useRef, useState } from "react";
// import { startSpeaking, stopSpeaking } from "./speechManager";
import {
  playChunk,
  resetAudioTiming,
  markTTSStreamEnded,
  setOnPlaybackEnded,
} from "./audioHelper";

export function useTTS(socket: any, resetTranscript: Function) {
  const queueRef = useRef<(() => Promise<void>)[]>([]);
  const isProcessingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  async function processQueue() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (queueRef.current.length) {
      const task = queueRef.current.shift();
      if (task) await task();
    }

    isProcessingRef.current = false;
  }

  function speak(text: string, onStart?: () => void, onEnd?: () => void) {
    return new Promise<void>((resolve) => {
      const task = async () => {
        // startSpeaking();
        setIsSpeaking(true);
        onStart?.(); // Pause mic

        setOnPlaybackEnded(() => {
          console.log("🎧 Playback fully completed");
          // stopSpeech(); // safe to restart mic
          onEnd?.(); // Resume mic
          setIsSpeaking(false);
        });

        socket.off("tts-audio");
        socket.off("tts-audio-end");

        socket.on("tts-audio", async (chunk: ArrayBuffer) => {
          await playChunk(chunk);
        });

        socket.on("tts-audio-end", () => {
          console.log("📡 Server finished sending audio");
          markTTSStreamEnded(); // ✅ THIS is the correct bridge
          resolve(); // queue can move on, audio may still be playing
        });

        socket.emit("tts-start", { text });
      };

      queueRef.current.push(task);
      processQueue();
    });
  }

  function stopSpeech() {
    console.log("⏹️ Stopping speech");

    // Clear queue
    queueRef.current = [];

    // Remove listeners
    socket.off("tts-audio");
    socket.off("tts-audio-end");

    // Close audio
    // closeAudioContext();
    resetAudioTiming();

    // Tell server to stop
    socket.emit("tts-stop");

    // Update UI state
    resetTranscript("");
    // stopSpeaking(resetTranscript);
  }

  return { speak, isSpeaking, stopSpeech };
}
