export async function getAudio(
  text: string,
): Promise<{ audio: HTMLAudioElement; audioUrl: string }> {
  const response = await fetch(
    `${import.meta.env.VITE_SERVER_URL}/api/tts/rime`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  return { audio, audioUrl };
}
