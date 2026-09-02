import type { SpeechSettings } from "../types/practice";

export function getEnglishVoices() {
  if (!("speechSynthesis" in window)) return [];
  const unsuitable = /bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox/i;
  const quality = /premium|enhanced|neural|natural|google|microsoft|samantha|daniel|karen/i;
  return window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en") && !unsuitable.test(voice.name))
    .sort((left, right) => Number(quality.test(right.name)) - Number(quality.test(left.name))
      || Number(right.lang.toLowerCase().startsWith("en-gb")) - Number(left.lang.toLowerCase().startsWith("en-gb"))
      || left.name.localeCompare(right.name));
}

export function speakEnglish(text: string, settings: SpeechSettings, callbacks: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = settings.rate;
  utterance.volume = settings.volume;
  const voices = getEnglishVoices();
  const voice = voices.find((item) => item.voiceURI === settings.voiceURI)
    || voices.find((item) => item.lang.toLowerCase().startsWith("en-gb"))
    || voices[0];
  if (voice) utterance.voice = voice;
  utterance.onstart = () => callbacks.onStart?.();
  utterance.onend = () => callbacks.onEnd?.();
  utterance.onerror = () => callbacks.onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function toggleSpeechPause() {
  if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) return false;
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  else window.speechSynthesis.pause();
  return window.speechSynthesis.paused;
}

export function stopSpeech() {
  window.speechSynthesis?.cancel();
}
