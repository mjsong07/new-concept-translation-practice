// 由 scripts/render-teacher-repetition.py 从《新概念英语 1（教师用书）》提取生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/teacher-notes/<课号>/page-*.png。
// 懒加载：首次请求某课图片 URL 时才加载对应 chunk，不进入首屏包。
const modules = import.meta.glob<string>("../assets/teacher-notes/*/page-*.png", { import: "default" });

interface SeqLoader {
  seq: number;
  load: () => Promise<string>;
}

const byLesson = new Map<number, SeqLoader[]>();

for (const [path, load] of Object.entries(modules)) {
  const m = path.match(/teacher-notes\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  const list = byLesson.get(lesson) || [];
  list.push({ seq, load });
  byLesson.set(lesson, list);
}

/** 懒加载教师用书图片 URL（按页序）；无图片的课返回空数组。 */
export function loadLessonTeacherNotesPages(lesson: number): Promise<string[]> {
  const loaders = byLesson.get(lesson);
  if (!loaders?.length) return Promise.resolve([]);
  return Promise.all(loaders.sort((a, b) => a.seq - b.seq).map((item) => item.load()));
}
