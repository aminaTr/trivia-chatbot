import socket from "@/api/socket";

/* ---------------- START ---------------- */
export const startTrivia = async (
  startMic: Function,
  startedRef: React.RefObject<boolean>,
  setStarted: Function,
  setSessionStatus: Function,
  difficulty: string,
  category: string,
  voice: string,
) => {
  await startMic(); // start browser audio FIRST
  socket.emit("stt-start"); // then tell server

  startedRef.current = true;
  setStarted(true);
  setSessionStatus("active");

  socket.emit("start-session", { difficulty, category, voice });
};
