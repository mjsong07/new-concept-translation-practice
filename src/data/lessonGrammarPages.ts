// 由 scripts/render-grammar-pages.py 从《新概念英语1语法练习》PDF 渲染生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/grammar-practice/<课号>/page-*.png。
const modules = import.meta.glob("../assets/grammar-practice/*/page-*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

interface SeqUrl {
  seq: number;
  url: string;
}

const byLesson: Record<number, SeqUrl[]> = {};

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/grammar-practice\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  (byLesson[lesson] ||= []).push({ seq, url });
}

for (const list of Object.values(byLesson)) {
  list.sort((a, b) => a.seq - b.seq);
}

export function lessonGrammarPages(lesson: number): string[] {
  return (byLesson[lesson] || []).map((p) => p.url);
}
