import type { SpeechSegment, SpeechSettings } from "../types/practice";

/**
 * 在线 TTS 兜底（Microsoft Edge TTS 代理）+ 预生成本地音频优先。
 *
 * 当设备系统 TTS（speechSynthesis）不可用或没有英文语音时，前端无法直接连
 * Edge 在线朗读接口（其握手要求伪造 Origin，浏览器做不到），因此由后端代理
 * 完成合成，前端只 fetch 代理返回的 MP3 并播放。代理地址见 server/edge-tts-proxy.mjs。
 *
 * 播放优先级：
 *   1. public/audio/ 下 scripts/generate-audio.mjs 预生成的 MP3（随站点/App 包
 *      分发，离线可用，安卓设备不依赖代理可达性）——语速用 playbackRate 适配，
 *      逐词边界时间按 playbackRate 反比缩放；
 *   2. 未命中时回退在线代理，按当前语速/音量实时合成。
 *
 * 每个朗读单元（utterance）经 WordBoundary 元数据映射到音频时间轴，驱动
 * onWordStart 实现逐词高亮；支持暂停/继续与停止。
 */

export interface EdgeBoundary {
  text: string;
  offset: number;
  duration: number;
}

export interface EdgeSegment {
  segment: SpeechSegment;
  /** 已解析好的 Edge 音色 id，如 en-GB-SoniaNeural */
  voice: string;
}

export interface EdgeSpeechCallbacks {
  onStart?: () => void;
  onSegmentStart?: (segment: SpeechSegment, index: number) => void;
  onWordStart?: (segment: SpeechSegment, index: number, characterOffset: number) => void;
  onEnd?: () => void;
}

/**
 * 在线 TTS 代理的默认 base URL。
 *
 * 前端静态页托管在 GitHub Pages（mjsong07.github.io），本身没有后端；发音请求
 * 跨域打到 Render 上运行的 edge-tts-proxy（其 CORS 为 *）。同源部署在 Render
 * 上时这个绝对地址也仍然命中 /tts。可用 localStorage 覆盖以指向局域网代理。
 */
const DEFAULT_EDGE_TTS_BASE = "https://new-concept-translation-practice.onrender.com";

/** 代理 base URL。默认走 Render 线上代理；可经 localStorage 覆盖。 */
export function edgeBaseUrl(): string {
  return localStorage.getItem("new-concept-edge-tts-base") || DEFAULT_EDGE_TTS_BASE;
}

/** 预生成音频清单条目：文件名 + 逐词边界 [word, offset, duration]（100ns 刻度，默认语速合成）。 */
interface LocalAudioEntry {
  f: string;
  b: [string, number, number][];
}

let localManifest: Record<string, LocalAudioEntry> | null | undefined;

/** 加载预生成音频清单（每个会话一次）；无清单时返回 null，全部回退在线代理。 */
async function loadLocalManifest(): Promise<Record<string, LocalAudioEntry> | null> {
  if (localManifest !== undefined) return localManifest;
  let loaded: Record<string, LocalAudioEntry> | null = null;
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}audio/manifest.json`);
    if (!resp.ok) throw new Error(`manifest 返回 ${resp.status}`);
    loaded = await resp.json();
  } catch {
    loaded = null;
  }
  localManifest = loaded;
  return localManifest;
}

let edgeGeneration = 0;
let edgeAudio: HTMLAudioElement | null = null;
let edgeRAF = 0;
let edgeTimers: number[] = [];

function clearScheduler() {
  if (edgeRAF) cancelAnimationFrame(edgeRAF);
  edgeRAF = 0;
  for (const t of edgeTimers) clearTimeout(t);
  edgeTimers = [];
}

function stopEdgeAudio() {
  clearScheduler();
  if (edgeAudio) {
    edgeAudio.pause();
    edgeAudio.onended = null;
    edgeAudio.src = "";
  }
  edgeAudio = null;
}

export function stopEdgeSpeech() {
  edgeGeneration += 1;
  stopEdgeAudio();
}

export function isEdgeSpeaking(): boolean {
  return !!edgeAudio && !edgeAudio.paused && !edgeAudio.ended;
}

export function toggleEdgePause(shouldPause = !edgeAudio?.paused): boolean {
  if (!edgeAudio) return false;
  if (shouldPause) edgeAudio.pause();
  else void edgeAudio.play();
  return shouldPause;
}

function ratePercent(rate: number): number {
  // settings.rate: 0.1–1.5，Edge <prosody rate> 用相对百分比（-100..100）
  return Math.max(-100, Math.min(100, Math.round((rate - 1) * 100)));
}

function volumePercent(volume: number): number {
  return Math.max(-100, Math.min(0, Math.round((volume - 1) * 100)));
}

/** 在 segment.text 中定位边界词的首字符下标（best-effort，大小写不敏感）。 */
function charIndexOf(segment: SpeechSegment, word: string, from: number): number {
  if (!word) return -1;
  const lowerText = segment.text.toLowerCase();
  const lowerWord = word.toLowerCase();
  let idx = lowerText.indexOf(lowerWord, from);
  // 未直接命中时，去掉词尾标点再找（如 word: "Yes?" / text: "Yes?"）。
  if (idx < 0) {
    const stripped = lowerWord.replace(/[^a-z0-9']+$/g, "");
    if (stripped) idx = lowerText.indexOf(stripped, from);
  }
  return idx;
}

/**
 * 朗读一段（单条 utterance）：fetch 代理 → 播放 MP3 → 按边界高亮 → 结束后播下一段。
 * 返回是否成功发起（若代理不可达或失败则返回 false）。
 */
export async function speakEdgeSequence(
  edgeSegments: EdgeSegment[],
  settings: SpeechSettings,
  callbacks: EdgeSpeechCallbacks = {}
): Promise<boolean> {
  const gen = ++edgeGeneration;
  stopEdgeAudio();

  const segments = edgeSegments.filter((s) => s.segment.text.trim());
  if (!segments.length) return false;

  async function playSegment(index: number): Promise<void> {
    if (gen !== edgeGeneration) return;
    if (index >= segments.length) {
      callbacks.onEnd?.();
      return;
    }
    const { segment, voice } = segments[index];
    callbacks.onSegmentStart?.(segment, index);

    let audio: HTMLAudioElement;
    let edgeBoundaries: EdgeBoundary[];
    const lookupText = segment.text.trim();
    const entry = (await loadLocalManifest())?.[`${voice}|${lookupText}`];
    if (entry) {
      // 预生成音频（默认语速、满音量合成）：语速用 playbackRate 适配，边界时间同比缩放；音量直接控制。
      audio = new Audio(`${import.meta.env.BASE_URL}audio/${entry.f}`);
      audio.playbackRate = settings.rate;
      audio.volume = settings.volume;
      edgeBoundaries = entry.b.map(([text, offset, duration]) => ({
        text,
        offset: offset / settings.rate,
        duration
      }));
    } else {
      const url =
        `${edgeBaseUrl()}/tts?text=${encodeURIComponent(segment.text)}&voice=${encodeURIComponent(voice)}` +
        `&rate=${ratePercent(settings.rate)}&volume=${volumePercent(settings.volume)}`;

      let data: { audio?: string; boundaries?: EdgeBoundary[] };
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Edge TTS 代理返回 ${resp.status}`);
        data = await resp.json();
      } catch (e) {
        // 代理不可达：静默失败，停止整段朗读，不中断调用方。
        callbacks.onEnd?.();
        return;
      }
      if (gen !== edgeGeneration || !data.audio) return;

      audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      audio.volume = 1; // 已由合成端 prosody 控制音量
      edgeBoundaries = data.boundaries || [];
    }
    edgeAudio = audio;

    try {
      await audio.play();
    } catch {
      // 播放被浏览器拦截（如用户无手势/静音限制）：跳过本段。
      audio.onended = null;
      callbacks.onEnd?.();
      return;
    }
    if (gen !== edgeGeneration) return;
    callbacks.onStart?.();

    // 调度逐词高亮：边界 offset 为 100ns 时间刻度 → 秒。
    const boundaries = edgeBoundaries.map((b) => ({
      time: b.offset / 1e7,
      charIndex: charIndexOf(segment, b.text, 0)
    }));
    let firedAt = -1;
    const tick = () => {
      if (gen !== edgeGeneration || !edgeAudio) return;
      const now = audio.currentTime;
      for (let i = firedAt + 1; i < boundaries.length; i++) {
        if (boundaries[i].time <= now + 0.01) {
          if (boundaries[i].charIndex >= 0) callbacks.onWordStart?.(segment, index, boundaries[i].charIndex);
          firedAt = i;
        } else break;
      }
      if (firedAt >= boundaries.length - 1) return;
      edgeRAF = requestAnimationFrame(tick);
    };
    edgeRAF = requestAnimationFrame(tick);

    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
    });
    if (gen !== edgeGeneration) return;
    clearScheduler();
    await playSegment(index + 1);
  }

  await playSegment(0);
  return true;
}
