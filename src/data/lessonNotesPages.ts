// 由 scripts/extract-notes-pdf.py 从《新概念1 课堂笔记&课后练习》PDF 渲染生成，请勿手工修改。
// import.meta.glob 会自动收录 src/assets/lesson-notes/<课号>/page-*.png。
const modules = import.meta.glob("../assets/lesson-notes/*/page-*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

interface SeqUrl {
  seq: number;
  url: string;
}

const byLesson: Record<number, SeqUrl[]> = {};

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/lesson-notes\/(\d+)\/page-(\d+)\.png$/);
  if (!m) continue;
  const lesson = Number(m[1]);
  const seq = Number(m[2]);
  (byLesson[lesson] ||= []).push({ seq, url });
}

export const lessonNotesPages: Record<number, string[]> = Object.fromEntries(
  Object.entries(byLesson).map(([lesson, pages]) => [
    Number(lesson),
    pages.sort((a, b) => a.seq - b.seq).map((p) => p.url),
  ]),
);
