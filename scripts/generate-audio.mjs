/**
 * 预生成全部朗读音频（Microsoft Edge TTS → public/audio/*.mp3 + manifest.json）。
 *
 * 背景：安卓等设备常因无系统英文语音或代理不可达导致在线发音失败；项目全部
 * 朗读文本都是静态数据，可一次性合成后随站点/后续 App 包分发，运行时直接播放
 * 本地 MP3，无需网络。
 *
 * 覆盖的朗读文本（与 src/components 构造 SpeechSegment 的逻辑保持一致）：
 *   - 奇数课 items.answer（TranslationExercise）
 *   - 偶数课书面练习 items 的 prompt / answer / 填空还原句（filledSentence）
 *   - 偶数课教师原文（lessonTeacherTranslations 逐句原文 + lessonTeacherOriginalLines 整读，含 T:/S: 前缀）
 *   - 点读单词（从上述文本按 clickableWords 同款正则提取）
 *   - 发音设置预览句
 *
 * 语速/音量：统一按默认语速（rate=0%）、满音量（volume=0%）合成；运行时语速用
 * <audio>.playbackRate 适配，逐词边界时间按 playbackRate 反比缩放（见
 * src/services/edgeTts.ts）。
 *
 * 用法：
 *   node scripts/generate-audio.mjs [--dry-run] [--limit=N] [--concurrency=N]
 *                                   [--out=public/audio] [--no-words]
 * 特性：已存在的 mp3 跳过（断点续跑）；失败条目重试 3 次后记入 generate-audio-failures.json。
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { EDGE_VOICES, synthesize } from "../server/edge-tts-synth.mjs";
import { lessons } from "../src/data/lessons.ts";
import { writtenExercises } from "../src/data/writtenExercises.ts";
import { getLessonTeacherTranslationPairs } from "../src/data/lessonTeacherTranslations.ts";
import { lessonTeacherOriginalLines } from "../src/data/lessonTeacherOriginalLines.ts";
import { speakerGender } from "../src/services/speakerGender.ts";

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const DRY_RUN = process.argv.includes("--dry-run");
const NO_WORDS = process.argv.includes("--no-words");
const LIMIT = Number(argValue("limit") || 0);
const CONCURRENCY = Math.max(1, Number(argValue("concurrency") || 4));
const OUT_DIR = fileURLToPath(new URL(`../${argValue("out") || "public/audio"}`, import.meta.url));

const EDGE_VOICE_BY_GENDER = {
  female: "en-GB-SoniaNeural",
  male: "en-GB-RyanNeural",
  unknown: "en-GB-SoniaNeural"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileFor(key) {
  return `${createHash("sha1").update(key, "utf8").digest("hex")}.mp3`;
}

// 与 src/components/WrittenExercise.vue 的 filledSentence 保持一致
function filledSentence(item) {
  const words = item.answer.split(",").map((part) => part.trim());
  let blankIndex = 0;
  return item.prompt.replace(/_____/g, () => words[blankIndex++] || "");
}

/** 汇总应用内全部朗读文本（与组件构造 SpeechSegment 的逻辑保持一致）。 */
function collect() {
  const out = [];
  const push = (text, speaker) => {
    const t = (text || "").trim();
    if (t) out.push({ text: t, speaker: (speaker || "").trim() });
  };

  // 奇数课：朗读参考答案（TranslationExercise）
  for (const lesson of lessons) for (const item of lesson.items) push(item.answer, item.speakerEn);

  // 课文标题（TranslationExercise 标题朗读按钮，无说话人 → 默认女声音色）
  for (const lesson of lessons) push(lesson.title, "");

  // 偶数课书面练习：写句子模式读 prompt 与 answer；填空模式读还原后的完整句
  for (const lesson of writtenExercises) {
    for (const item of lesson.items) {
      if (item.mode === "fill") push(filledSentence(item), item.speakerEn);
      else { push(item.prompt, item.speakerEn); push(item.answer, item.speakerEn); }
    }
  }

  // 偶数课教师原文：双语阅读逐句原文 + 原文整读（含 T:/S: 前缀）
  const SKIP_ORIGINAL = "Play the examples on the tape.";
  for (const pairs of Object.values(getLessonTeacherTranslationPairs())) {
    for (const pair of pairs) {
      if (pair.original === SKIP_ORIGINAL) continue;
      push(pair.original, "ORIGINAL");
    }
  }
  for (const lines of Object.values(lessonTeacherOriginalLines)) {
    for (const line of lines) push(line, "ORIGINAL");
  }

  // 发音设置预览句（App.vue previewSpeechSettings）
  push("This is a preview of the current voice, speed and volume.", "");
  return out;
}

async function main() {
  const segments = collect();

  // 文本(+说话人 → 音色) 去重
  const tasks = new Map();
  const addText = (text, speaker) => {
    const gender = speaker ? speakerGender(speaker) : "unknown";
    const voice = EDGE_VOICE_BY_GENDER[gender];
    const key = `${voice}|${text}`;
    if (!tasks.has(key)) tasks.set(key, { key, voice, text, file: fileFor(key) });
  };
  for (const segment of segments) addText(segment.text, segment.speaker);

  if (!NO_WORDS) {
    const words = new Set();
    for (const segment of segments) {
      for (const match of segment.text.matchAll(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g)) words.add(match[0]);
    }
    for (const word of words) addText(word, "");
  }

  let list = [...tasks.values()].sort((a, b) => a.key < b.key ? -1 : 1);
  if (LIMIT > 0) list = list.slice(0, LIMIT);

  const totalChars = list.reduce((sum, t) => sum + t.text.length, 0);
  console.log(`朗读条目 ${list.length} 条（去重后），总字符 ${totalChars}，音色 ${[...new Set(list.map(t => t.voice))].join(", ")}`);
  if (DRY_RUN) return;

  await mkdir(OUT_DIR, { recursive: true });

  // 断点续跑：manifest 中已有的条目跳过
  const manifestPath = `${OUT_DIR}/manifest.json`;
  const manifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : {};
  const pending = [];
  let skipped = 0;
  for (const task of list) {
    if (manifest[task.key] && existsSync(`${OUT_DIR}/${task.file}`)) skipped += 1;
    else pending.push(task);
  }
  console.log(`跳过已生成 ${skipped} 条，待合成 ${pending.length} 条（并发 ${CONCURRENCY}）`);

  const failures = [];
  let done = 0;
  let bytes = 0;
  const startedAt = Date.now();
  const totalPending = pending.length;

  async function worker() {
    for (;;) {
      const task = pending.shift();
      if (!task) return;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { audio, boundaries } = await synthesize(task.text, task.voice, 0, 0);
          await writeFile(`${OUT_DIR}/${task.file}`, audio);
          manifest[task.key] = {
            f: task.file,
            b: boundaries.map((b) => [b.text, b.offset, b.duration])
          };
          done += 1;
          bytes += audio.length;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await sleep(2000 * (attempt + 1));
        }
      }
      if (lastError) {
        failures.push({ key: task.key, error: String((lastError && lastError.message) || lastError) });
      }
      const finished = done + failures.length;
      if (finished % 50 === 0 || finished === totalPending) {
        const rate = done / ((Date.now() - startedAt) / 1000);
        console.log(`进度 ${finished}/${totalPending}（成功 ${done}，失败 ${failures.length}，${rate.toFixed(1)} 条/秒）`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await writeFile(manifestPath, JSON.stringify(manifest));
  if (failures.length) {
    await writeFile(`${OUT_DIR}/generate-audio-failures.json`, JSON.stringify(failures, null, 2));
  }
  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`完成：新增 ${done} 条，${mb} MB， manifest 共 ${Object.keys(manifest).length} 条，失败 ${failures.length} 条`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
