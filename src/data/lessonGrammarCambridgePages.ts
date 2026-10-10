// 由 scripts/render-cambridge-grammar.py 从《剑桥初级英语语法(第3版中文)》渲染生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/grammar-cambridge/*/page-*.png。
// 懒加载：首次请求某课图片 URL 时才加载对应 chunk，不进入首屏包。
const modules = import.meta.glob<string>("../assets/grammar-cambridge/*/page-*.png", { import: "default" });

interface SeqLoader {
  seq: number;
  load: () => Promise<string>;
}

const byLesson = new Map<number, SeqLoader[]>();

for (const [path, load] of Object.entries(modules)) {
  const m = path.match(/grammar-cambridge\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  const list = byLesson.get(lesson) || [];
  list.push({ seq, load });
  byLesson.set(lesson, list);
}

for (const list of byLesson.values()) {
  list.sort((a, b) => a.seq - b.seq);
}

/** 懒加载剑桥语法单元图片 URL（按页序）；无图片的课返回空数组。 */
export function loadLessonGrammarCambridgePages(lesson: number): Promise<string[]> {
  const loaders = byLesson.get(lesson);
  if (!loaders?.length) return Promise.resolve([]);
  return Promise.all(loaders.map((item) => item.load()));
}
