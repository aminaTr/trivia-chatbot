// Function to speak question
export const speakQuestion = (text: string, fu: () => void) => {
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utter);
  fu();
};

export const speakText = (text: string) => {
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utter);
};
