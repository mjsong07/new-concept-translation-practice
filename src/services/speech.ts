import type { SpeechSegment, SpeechSettings } from "../types/practice";

const supportedVoiceNames = ["Tessa", "Moira", "Samantha", "Karen", "Daniel", "Rishi"] as const;
const femaleVoiceNames = new Set(["Tessa", "Moira", "Samantha", "Karen"]);
const maleVoiceNames = new Set(["Daniel", "Rishi"]);
const femaleSpeakers = new Set([
  "AMY", "ANN", "ANNA", "CAROL", "CAROLINE", "CATHERINE", "CHARLOTTE", "CHRISTINE", "HELEN", "JANE",
  "JEAN", "JENNY", "JILL", "JULIE", "KATE", "LINDA", "LIZ", "LOUISE", "LUCY", "MISS MARSH", "NAOKO",
  "PAMELA", "PAULINE", "PENNY", "SANDRA", "SOPHIE", "SUSAN", "XIAOHUI"
]);
const maleSpeakers = new Set([
  "ANDY", "BOB", "BRIAN", "CHANG-WOO", "DAN", "DAVE", "DIMITRI", "GARY", "GEORGE", "GRAHAM TURNER",
  "HANS", "IAN", "JACK", "JIM", "JOHN SMITH", "KEN", "LUMING", "MARTIN", "MIKE", "NIGEL", "PETER",
  "RICHARD", "ROBERT", "SAM", "SCOTT", "STEVEN", "TIM", "TOM"
]);

let speechGeneration = 0;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let speechKeepAliveTimer: number | undefined;

function clearSpeechKeepAlive() {
  if (speechKeepAliveTimer !== undefined) window.clearInterval(speechKeepAliveTimer);
  speechKeepAliveTimer = undefined;
}

function keepLongChromeSpeechAlive() {
  clearSpeechKeepAlive();
  if (!/(?:Chrome|CriOS)/i.test(navigator.userAgent)) return;
  speechKeepAliveTimer = window.setInterval(() => {
    if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return;
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10000);
}

function supportedName(voice: SpeechSynthesisVoice) {
  return supportedVoiceNames.find((name) => new RegExp(`\\b${name}\\b`, "i").test(voice.name));
}

export function getEnglishVoices() {
  if (!("speechSynthesis" in window)) return [];
  const quality = /premium|enhanced|neural|natural/i;
  const candidates = window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en") && supportedName(voice))
    .sort((left, right) => Number(quality.test(right.name)) - Number(quality.test(left.name)));
  const voicesByName = new Map<string, SpeechSynthesisVoice>();
  candidates.forEach((voice) => {
    const name = supportedName(voice);
    if (name && !voicesByName.has(name)) voicesByName.set(name, voice);
  });
  return supportedVoiceNames.flatMap((name) => voicesByName.get(name) || []);
}

function speakerGender(speaker: string): "female" | "male" | "unknown" {
  const normalized = speaker.trim().toUpperCase();
  if (femaleSpeakers.has(normalized) || /\b(MRS|MISS|MOTHER|GRANDMOTHER|WOMAN|LADY|GIRLS?|NURSE)\b/.test(normalized)) return "female";
  if (maleSpeakers.has(normalized) || /\b(MR|FATHER|MAN|BOY|POLICEMAN)\b/.test(normalized)) return "male";
  return "unknown";
}

function assignSpeakerVoices(segments: SpeechSegment[], voices: SpeechSynthesisVoice[], preferred?: SpeechSynthesisVoice) {
  const femaleVoices = voices.filter((voice) => femaleVoiceNames.has(supportedName(voice) || ""));
  const maleVoices = voices.filter((voice) => maleVoiceNames.has(supportedName(voice) || ""));
  const voicePools = {
    female: femaleVoices.length ? [...femaleVoices] : [...voices],
    male: maleVoices.length ? [...maleVoices] : [...voices],
    unknown: [...voices]
  };
  const offsets = { female: 0, male: 0, unknown: 0 };
  const assignments = new Map<string, SpeechSynthesisVoice>();

  segments.forEach((segment) => {
    const speaker = segment.speaker?.trim().toUpperCase();
    if (!speaker || assignments.has(speaker)) return;
    const gender = speakerGender(speaker);
    const pool = voicePools[gender];
    if (!pool.length) return;
    const preferredIndex = preferred ? pool.findIndex((voice) => voice.voiceURI === preferred.voiceURI) : -1;
    if (offsets[gender] === 0 && preferredIndex > 0) pool.unshift(...pool.splice(preferredIndex, 1));
    assignments.set(speaker, pool[offsets[gender] % pool.length]);
    offsets[gender] += 1;
  });
  return assignments;
}

export function speakEnglishSequence(
  sourceSegments: SpeechSegment[],
  settings: SpeechSettings,
  callbacks: {
    onStart?: () => void;
    onSegmentStart?: (segment: SpeechSegment, index: number) => void;
    onEnd?: () => void;
  } = {}
) {
  if (!("speechSynthesis" in window)) return false;
  const segments = sourceSegments.filter((segment) => segment.text.trim());
  if (!segments.length) return false;

  const generation = ++speechGeneration;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const voices = getEnglishVoices();
  const preferred = voices.find((voice) => voice.voiceURI === settings.voiceURI) || voices[0];
  const speakerVoices = assignSpeakerVoices(segments, voices, preferred);
  let started = false;

  function play(index: number) {
    if (generation !== speechGeneration) return;
    if (index >= segments.length) {
      callbacks.onEnd?.();
      return;
    }
    const segment = segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    activeUtterance = utterance;
    utterance.lang = "en-GB";
    utterance.rate = settings.rate;
    utterance.volume = settings.volume;
    const speakerVoice = segment.speaker ? speakerVoices.get(segment.speaker.trim().toUpperCase()) : undefined;
    utterance.voice = speakerVoice || preferred || null;
    utterance.onstart = () => {
      if (generation !== speechGeneration) return;
      keepLongChromeSpeechAlive();
      if (!started) {
        started = true;
        callbacks.onStart?.();
      }
      callbacks.onSegmentStart?.(segment, index);
    };
    utterance.onend = () => {
      clearSpeechKeepAlive();
      if (activeUtterance === utterance) activeUtterance = null;
      play(index + 1);
    };
    utterance.onerror = () => {
      clearSpeechKeepAlive();
      if (activeUtterance === utterance) activeUtterance = null;
      play(index + 1);
    };
    window.speechSynthesis.speak(utterance);
  }

  play(0);
  return true;
}

export function speakEnglish(text: string, settings: SpeechSettings, callbacks: { onStart?: () => void; onEnd?: () => void } = {}) {
  return speakEnglishSequence([{ text }], settings, callbacks);
}

export function toggleSpeechPause() {
  if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) return false;
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  else window.speechSynthesis.pause();
  return window.speechSynthesis.paused;
}

export function stopSpeech() {
  speechGeneration += 1;
  clearSpeechKeepAlive();
  window.speechSynthesis?.cancel();
  activeUtterance = null;
}
