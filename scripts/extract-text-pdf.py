"""一次性脚本：从《新概念英语1》课文 PDF 中按课号渲染教材页为 PNG。

该 PDF 为扫描版（无文字层），共 299 页。经逐页 OCR 页眉核对，版式规律为：
- 前 4 页为封面/目录，从第 5 页起进入课文。
- 第 1~72 课：每课占连续 2 页，第 n 课起始 PDF 页(1based) = 2n + 3。
- 第 149~152 页为隔页/插页（无课号），之后第 73 课起继续：起始页 = 2n + 7。
- 每课两页 = 课文对话页 + 生词/课文注释/参考译文页。

应用内只出现奇数课（1,3,5,...,143），因此只渲染这些课的两页。
输出到 src/assets/lesson-text/<课号>/page-<序号>.png。
"""
from pathlib import Path
import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/《新概念英语》第1册+pdf课文.pdf"
OUT = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/assets/lesson-text")

APP_LESSONS = list(range(1, 145, 2))  # 1,3,...,143


def start_page(n: int) -> int:
    """返回第 n 课的起始 PDF 页（1based）。"""
    return 2 * n + 3 if n <= 72 else 2 * n + 7


doc = pymupdf.open(PDF)
OUT.mkdir(parents=True, exist_ok=True)
matrix = pymupdf.Matrix(2.0, 2.0)  # 教材小字较密，2x 保证缩放后清晰

print("课号 -> PDF页(1based)")
for n in APP_LESSONS:
    s = start_page(n)
    pages = [s, s + 1]
    d = OUT / str(n)
    d.mkdir(exist_ok=True)
    for seq, p1 in enumerate(pages, start=1):
        pix = doc[p1 - 1].get_pixmap(matrix=matrix, alpha=False)
        pix.save(str(d / f"page-{seq}.png"))
    print(f"  L{n:>3}: pages {pages}")

print("渲染课数:", len(APP_LESSONS))
