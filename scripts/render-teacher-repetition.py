"""从《新概念英语 1（教师用书）》提取偶数课 repetition drill(a) 截图。

提取范围（每个偶数课）：
- 起点：`* Play the examples on the tape` 所在行；
- 终点：`(b) Group or individual repetition` 所在行之前（不包含该行）。

输出目录结构：
- <out>/<lesson>/page-1.png
- <out>/<lesson>/page-2.png
- ...（若该段跨页）
"""

from __future__ import annotations

import argparse
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

import pymupdf

PLAY_RE = re.compile(r"play\s+the\s+examples?\s+on\s+the\s+tape", re.I)
GROUP_HEAD_RE = re.compile(r"group\s+or\s+individual", re.I)
PATTERN_DRILL_RE = re.compile(r"pattern\s+drill", re.I)


@dataclass(frozen=True)
class Line:
    y0: float
    y1: float
    text: str


def normalize(text: str) -> str:
    return " ".join(text.lower().split())


def page_lines(page: pymupdf.Page) -> list[Line]:
    out: list[Line] = []
    d = page.get_text("dict")
    for block in d.get("blocks", []):
        for line in block.get("lines", []):
            txt = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if not txt:
                continue
            x0, y0, x1, y1 = line["bbox"]
            _ = x0, x1  # 仅使用 y 坐标；保留赋值便于后续扩展。
            out.append(Line(y0=float(y0), y1=float(y1), text=txt))
    out.sort(key=lambda ln: ln.y0)
    return out


def find_start_pages(doc: pymupdf.Document, lessons: list[int]) -> dict[int, int]:
    result: dict[int, int] = {}
    cached_page_text = [doc[i].get_text("text") or "" for i in range(doc.page_count)]
    for lesson in lessons:
        lesson_re = re.compile(rf"\bLesson\s*{lesson}\b", re.I)
        for idx, text in enumerate(cached_page_text):
            if lesson_re.search(text) and PLAY_RE.search(text):
                result[lesson] = idx
                break
    return result


def find_start_y(lines: list[Line]) -> float | None:
    for ln in lines:
        if PLAY_RE.search(ln.text):
            return ln.y0
    return None


def find_end_marker(
    doc: pymupdf.Document,
    start_page: int,
    start_y: float,
    search_end_page_exclusive: int,
) -> tuple[int, float] | None:
    for page_idx in range(start_page, search_end_page_exclusive):
        lines = page_lines(doc[page_idx])
        for ln in lines:
            if page_idx == start_page and ln.y0 <= start_y:
                continue
            text_norm = normalize(ln.text)
            if GROUP_HEAD_RE.search(text_norm):
                return page_idx, ln.y0
    return None


def find_pattern_drill(
    doc: pymupdf.Document,
    start_page: int,
    start_y: float,
    search_end_page_exclusive: int,
) -> tuple[int, float] | None:
    for page_idx in range(start_page, search_end_page_exclusive):
        lines = page_lines(doc[page_idx])
        for ln in lines:
            if page_idx == start_page and ln.y0 <= start_y:
                continue
            if PATTERN_DRILL_RE.search(normalize(ln.text)):
                return page_idx, ln.y0
    return None


def render_slice(
    doc: pymupdf.Document,
    page_idx: int,
    top: float,
    bottom: float,
    out_file: Path,
    matrix: pymupdf.Matrix,
) -> bool:
    rect = doc[page_idx].rect
    clip = pymupdf.Rect(0, max(0, top), rect.width, min(rect.height, bottom))
    if clip.height < 12:
        return False
    pix = doc[page_idx].get_pixmap(matrix=matrix, clip=clip, alpha=False)
    pix.save(str(out_file))
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="提取老师版 PDF 偶数课 repetition drill(a) 截图")
    parser.add_argument("--pdf", required=True, help="老师版 PDF 路径")
    parser.add_argument(
        "--out",
        default="src/assets/teacher-notes",
        help="输出目录（默认：src/assets/teacher-notes）",
    )
    parser.add_argument("--scale", type=float, default=1.8, help="渲染缩放倍率（默认 1.8）")
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF 不存在: {pdf_path}")

    doc = pymupdf.open(str(pdf_path))
    lessons = list(range(2, 145, 2))

    start_pages = find_start_pages(doc, lessons)
    missing = [n for n in lessons if n not in start_pages]
    if missing:
        raise RuntimeError(f"以下课号未找到起始页（Lesson + Play）：{missing}")

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    matrix = pymupdf.Matrix(args.scale, args.scale)
    summary: list[tuple[int, int, int, int, str]] = []
    # lesson, start_page(1-based), end_page(1-based), images_count, end_mode

    for lesson in lessons:
        start_page = start_pages[lesson]
        next_page = start_pages.get(lesson + 2, doc.page_count)

        start_lines = page_lines(doc[start_page])
        start_y = find_start_y(start_lines)
        if start_y is None:
            raise RuntimeError(f"Lesson {lesson} 在第 {start_page + 1} 页未定位到 Play 行")

        end = find_end_marker(doc, start_page, start_y, next_page)
        end_mode = "group"
        if end is None:
            end = find_pattern_drill(doc, start_page, start_y, next_page)
            end_mode = "pattern-drill"

        if end is None:
            # 理论上不会走到这里；兜底：裁到下一课开始前一页底部。
            end_page = max(start_page, next_page - 1)
            end_y = float(doc[end_page].rect.height)
            end_mode = "fallback-page-end"
        else:
            end_page, end_y = end

        lesson_dir = out_dir / str(lesson)
        lesson_dir.mkdir(parents=True, exist_ok=True)

        seq = 0
        for page_idx in range(start_page, end_page + 1):
            top = start_y - 6 if page_idx == start_page else 0
            bottom = end_y - 6 if page_idx == end_page else float(doc[page_idx].rect.height)
            seq += 1
            ok = render_slice(
                doc,
                page_idx=page_idx,
                top=top,
                bottom=bottom,
                out_file=lesson_dir / f"page-{seq}.png",
                matrix=matrix,
            )
            if not ok:
                seq -= 1

        summary.append((lesson, start_page + 1, end_page + 1, seq, end_mode))

    print("提取完成：")
    for lesson, sp, ep, cnt, mode in summary:
        print(f"  L{lesson:>3}: p{sp} -> p{ep}, {cnt} 张（end={mode}）")
    print(f"总课数: {len(summary)}")


if __name__ == "__main__":
    main()
