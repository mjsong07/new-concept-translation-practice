"""重新渲染「原书」课堂笔记页：按每课开头的大字号课号位置纵向切分物理页。

背景：笔记 PDF 是连续排版的，相邻两课常挤在同一物理页上（如第 8 页上半是第 1 课、
下半 y≈510 处开始第 2 课）。旧脚本按整页归属，导致奇数课页底混入下一课内容、
偶数课又整体继承上一课，两课图片雷同。

做法：
- 扫描每页，定位大字号（≥30pt）纯数字课号标记，得到 课号 -> (PDF页0based, y)。
- 第 23/24 课共用标题 "23 24"，两课共用同一段区域。
- 第 n 课内容 = 从其标记 (Pn, yn) 到下一课标记 (Pn+1, yn+1) 之间：
  - 起始页 Pn：从 yn 裁到页底；
  - 中间页：整页；
  - 结束页 Pn+1：从页顶裁到 yn+1（不含下一课）。
- 整页 Cornell 空白作业页（Questions/Homework/Summary）跳过不渲染。
输出覆盖 src/assets/lesson-notes/<课号>/page-<序号>.png。
"""
import re
import shutil
from pathlib import Path

import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/新概念英语+1+课堂笔记&课后练习.pdf"
OUT = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/assets/lesson-notes")

doc = pymupdf.open(PDF)
PAGE_H = doc[0].rect.height
num_extract = re.compile(r"\d+")

# 1) 大字号课号标记（标题可能是 "23 24" 合并形式，从中提取每个数字）
markers: dict[int, tuple[int, float]] = {}
for idx in range(doc.page_count):
    d = doc[idx].get_text("dict")
    for b in d.get("blocks", []):
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                txt = s["text"].strip()
                if s["size"] >= 30 and txt:
                    for num in num_extract.findall(txt):
                        markers[int(num)] = (idx, l["bbox"][1])

# 2) Cornell 空白作业页判定（复用旧脚本启发式）
def is_cornell(idx: int) -> bool:
    t = doc[idx].get_text("text", sort=True)
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    return bool(lines) and lines[0].startswith("Questions") and len(t) < 260

# 3) 清理旧输出
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

matrix = pymupdf.Matrix(1.6, 1.6)  # 与旧版一致，约 115 DPI

def render_slice(idx: int, top: float, bottom: float, path: Path):
    rect = doc[idx].rect
    clip = pymupdf.Rect(0, max(0, top), rect.width, min(rect.height, bottom))
    if clip.height < 20:  # 太矮的切片跳过
        return False
    pix = doc[idx].get_pixmap(matrix=matrix, clip=clip, alpha=False)
    pix.save(str(path))
    return True

summary = {}
for n in range(1, 145):
    if n not in markers:
        continue
    start_idx, start_y = markers[n]
    # 结束边界 = 下一个位置与本课不同的标记（处理 23/24 共用起点）
    end_idx, end_y = doc.page_count - 1, PAGE_H + 1
    for k in range(n + 1, 145):
        if k in markers and markers[k] != (start_idx, start_y):
            end_idx, end_y = markers[k]
            break

    d = OUT / str(n)
    d.mkdir(exist_ok=True)
    seq = 0
    for p in range(start_idx, end_idx + 1):
        if is_cornell(p):
            continue
        top = start_y if p == start_idx else 0
        bottom = end_y if p == end_idx else PAGE_H
        seq += 1
        ok = render_slice(p, top, bottom, d / f"page-{seq}.png")
        if not ok:
            seq -= 1
    if seq:
        summary[n] = seq

print("课号 -> 渲染页数")
for n in sorted(summary):
    print(f"  L{n:>3}: {summary[n]} 页")
print("有图的课数:", len(summary))
