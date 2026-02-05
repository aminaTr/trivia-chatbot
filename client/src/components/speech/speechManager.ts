import SpeechRecognition from "react-speech-recognition";

let speaking = false;

export function isSpeaking() {
  return speaking;
}

export function startSpeaking() {
  speaking = true;
  SpeechRecognition.stopListening();
}

export function stopSpeaking(resetTranscript: () => void) {
  speaking = false;
  resetTranscript();
  SpeechRecognition.startListening({
    continuous: true,
    language: "en-US",
  });
}

export function stopListeningPermanently(resetTranscript: () => void) {
  resetTranscript();
  speaking = true;
  console.log("object");
  SpeechRecognition.stopListening();
}
