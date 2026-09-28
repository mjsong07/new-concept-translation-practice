// 由 scripts/extract-text-pdf.py 从《新概念英语1》课文 PDF 渲染生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/lesson-text/<课号>/page-*.png。
const modules = import.meta.glob("../assets/lesson-text/*/page-*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

interface SeqUrl {
  seq: number;
  url: string;
}

const byLesson: Record<number, SeqUrl[]> = {};

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/lesson-text\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  (byLesson[lesson] ||= []).push({ seq, url });
}

export const lessonTextPages: Record<number, string[]> = Object.fromEntries(
  Object.entries(byLesson).map(([lesson, pages]) => [
    Number(lesson),
    pages.sort((a, b) => a.seq - b.seq).map((p) => p.url),
  ]),
);
