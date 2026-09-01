import type { SpeechSettings } from "../types/practice";

export function getEnglishVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
}

export function speakEnglish(text: string, settings: SpeechSettings) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = settings.rate;
  const voices = getEnglishVoices();
  const voice = voices.find((item) => item.voiceURI === settings.voiceURI)
    || voices.find((item) => item.lang.toLowerCase().startsWith("en-gb"))
    || voices[0];
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}
