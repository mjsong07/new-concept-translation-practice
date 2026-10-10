// 由 scripts/render-grammar-pages.py 从《新概念英语1语法练习》PDF 渲染生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/grammar-practice/<课号>/page-*.png 与 answer-*.png。
// 懒加载：首次请求某课图片 URL 时才加载对应 chunk，不进入首屏包。
const questionModules = import.meta.glob<string>("../assets/grammar-practice/*/page-*.png", { import: "default" });
const answerModules = import.meta.glob<string>("../assets/grammar-practice/*/answer-*.png", { import: "default" });

interface SeqLoader {
  seq: number;
  load: () => Promise<string>;
}

function collect(modules: Record<string, () => Promise<string>>, prefix: string): Map<number, SeqLoader[]> {
  const byLesson = new Map<number, SeqLoader[]>();
  for (const [path, load] of Object.entries(modules)) {
    const m = path.match(new RegExp(`grammar-practice/(\\d+)/${prefix}-(\\d+)\\.png$`));
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
  return byLesson;
}

const questionsByLesson = collect(questionModules, "page");
const answersByLesson = collect(answerModules, "answer");

/** 懒加载语法练习题目图片 URL（按页序）；无图片的课返回空数组。 */
export function loadLessonGrammarPages(lesson: number): Promise<string[]> {
  const loaders = questionsByLesson.get(lesson);
  if (!loaders?.length) return Promise.resolve([]);
  return Promise.all(loaders.map((item) => item.load()));
}

/** 懒加载语法练习答案图片 URL（按页序）；无图片的课返回空数组。 */
export function loadLessonGrammarAnswerPages(lesson: number): Promise<string[]> {
  const loaders = answersByLesson.get(lesson);
  if (!loaders?.length) return Promise.resolve([]);
  return Promise.all(loaders.map((item) => item.load()));
}
