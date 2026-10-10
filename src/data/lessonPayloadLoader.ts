import type { LessonPayload } from "../types/practice";

// 按课拆分的课程数据（scripts/split-lesson-data.mjs 生成），进入课程时才加载对应 chunk。
const modules = import.meta.glob<LessonPayload>("./lesson-payloads/*.ts", { import: "default" });

const cache = new Map<number, Promise<LessonPayload | null>>();

/** 懒加载指定课号的课程数据；无对应数据时返回 null。结果按会话缓存。 */
export function loadLessonPayload(lesson: number): Promise<LessonPayload | null> {
  const loader = modules[`./lesson-payloads/${lesson}.ts`];
  if (!loader) return Promise.resolve(null);
  let cached = cache.get(lesson);
  if (!cached) {
    cached = loader().catch(() => null);
    cache.set(lesson, cached);
  }
  return cached;
}
