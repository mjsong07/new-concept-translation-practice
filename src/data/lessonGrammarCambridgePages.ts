// 由 scripts/render-cambridge-grammar.py 从《剑桥初级英语语法(第3版中文)》渲染生成，请勿手工修改。
const modules = import.meta.glob("../assets/grammar-cambridge/*/page-*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

interface SeqUrl {
  seq: number;
  url: string;
}

const byLesson: Record<number, SeqUrl[]> = {};

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/grammar-cambridge\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  (byLesson[lesson] ||= []).push({ seq, url });
}

for (const list of Object.values(byLesson)) {
  list.sort((a, b) => a.seq - b.seq);
}

export function lessonGrammarCambridgePages(lesson: number): string[] {
  return (byLesson[lesson] || []).map((p) => p.url);
}
