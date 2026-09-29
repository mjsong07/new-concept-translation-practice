import type { SpeechSegment, SpeechSettings } from "../types/practice";

// 以下音色名为 Apple 系统（macOS/iOS）内置英语语音。Android 上 Google TTS
// 的音色名完全不同（如 “Google US English”“Google UK English Female” 等）。
const appleVoiceNames = ["Tessa", "Moira", "Samantha", "Karen", "Daniel", "Rishi"] as const;
const appleFemaleVoiceNames = new Set(["Tessa", "Moira", "Samantha", "Karen"]);
const appleMaleVoiceNames = new Set(["Daniel", "Rishi"]);
const isApplePlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

function appleVoiceName(voice: SpeechSynthesisVoice) {
  return appleVoiceNames.find((name) => new RegExp(`\\b${name}\\b`, "i").test(voice.name));
}

function isGoogleEnglishVoice(voice: SpeechSynthesisVoice) {
  if (!voice.lang.toLowerCase().startsWith("en")) return false;
  return /\bGoogle\b/i.test(voice.name) || /google/i.test(voice.voiceURI);
}
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

export function getEnglishVoices() {
  if (!("speechSynthesis" in window)) return [];
  const quality = /premium|enhanced|neural|natural/i;
  const english = window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"));

  let candidates: SpeechSynthesisVoice[];
  if (isApplePlatform) {
    // macOS / iOS：保留人工挑选的 Apple 音色，避免声音列表被系统内置语音刷屏。
    candidates = english.filter((voice) => appleVoiceName(voice));
  } else {
    // Android / 其他平台：优先 Google TTS 英语音色；若设备上没有任何 Google 音色，
    // 回退到任意英语音色。否则语音列表为空，会导致部分安卓设备静默无声。
    const google = english.filter(isGoogleEnglishVoice);
    candidates = google.length ? google : english;
  }
  const ranked = [...candidates]
    .sort((left, right) => Number(quality.test(right.name)) - Number(quality.test(left.name)));

  const seen = new Set<string>();
  const result: SpeechSynthesisVoice[] = [];
  for (const voice of ranked) {
    const key = appleVoiceName(voice) || voice.name;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(voice);
  }
  return result;
}

function speakerGender(speaker: string): "female" | "male" | "unknown" {
  const normalized = speaker.trim().toUpperCase();
  if (femaleSpeakers.has(normalized) || /\b(MRS|MISS|MOTHER|GRANDMOTHER|WOMAN|LADY|GIRLS?|NURSE)\b/.test(normalized)) return "female";
  if (maleSpeakers.has(normalized) || /\b(MR|FATHER|MAN|BOY|POLICEMAN)\b/.test(normalized)) return "male";
  return "unknown";
}

function assignSpeakerVoices(segments: SpeechSegment[], voices: SpeechSynthesisVoice[], preferred?: SpeechSynthesisVoice) {
  const femaleVoices = voices.filter((voice) => appleFemaleVoiceNames.has(appleVoiceName(voice) || ""));
  const maleVoices = voices.filter((voice) => appleMaleVoiceNames.has(appleVoiceName(voice) || ""));
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
    onWordStart?: (segment: SpeechSegment, index: number, characterOffset: number) => void;
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
  const preferred = voices.find((voice) => voice.voiceURI === settings.voiceURI)
    || voices.find((voice) => /\bKaren\b/i.test(voice.name))
    || voices[0];
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
    utterance.onboundary = (event) => {
      if (generation !== speechGeneration || event.name !== "word") return;
      callbacks.onWordStart?.(segment, index, event.charIndex);
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

export function toggleSpeechPause(shouldPause = !window.speechSynthesis?.paused) {
  if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) return false;
  if (shouldPause) window.speechSynthesis.pause();
  else window.speechSynthesis.resume();
  return shouldPause;
}

export function stopSpeech() {
  speechGeneration += 1;
  clearSpeechKeepAlive();
  window.speechSynthesis?.cancel();
  activeUtterance = null;
}
