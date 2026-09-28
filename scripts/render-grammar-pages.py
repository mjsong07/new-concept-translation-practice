"""渲染「练习」分组里的语法练习截图：每课对应《新概念英语1语法练习》PDF 的若干页。

PDF 是扫描版（无文字层），通过目录手工建立 课号 -> 印刷起始页 映射。
印刷页 P 对应 PDF 页索引 P+13（已核对：印刷页1 = Lesson1 = PDF 索引14）。
每课内容 = 从其起始印刷页到下一课起始印刷页前一页。
输出到 src/assets/grammar-practice/<课号>/page-<序号>.png。
"""
import shutil
from pathlib import Path

import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/新概念英语1语法练习.pdf"
OUT = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/assets/grammar-practice")
OFFSET = 13  # 印刷页 -> PDF 索引

# 课号 -> 印刷起始页（来自书末目录）
START = {
    1: 1, 2: 3, 3: 5, 4: 8, 5: 10, 6: 14, 7: 16, 8: 20, 9: 23, 10: 26,
    11: 28, 12: 31, 13: 33, 14: 35, 15: 38, 16: 41, 17: 44, 18: 47, 19: 50, 20: 53,
    21: 55, 22: 57, 23: 60, 24: 64, 25: 67, 26: 70, 27: 73, 28: 77, 29: 80, 30: 83,
    31: 85, 32: 88, 33: 91, 34: 93, 35: 95, 36: 98, 37: 100, 38: 103, 39: 106, 40: 110,
    41: 114, 42: 117, 43: 119, 44: 123, 45: 126, 46: 129, 47: 131, 48: 134, 49: 136, 50: 139,
    51: 142, 52: 145, 53: 148, 54: 151, 55: 154, 56: 157, 57: 159, 58: 162, 59: 166, 60: 169,
    61: 172, 62: 176, 63: 179, 64: 182, 65: 184, 66: 187, 67: 189, 68: 193, 69: 195, 70: 199,
    71: 202, 72: 205, 73: 208, 74: 212, 75: 214, 76: 218, 77: 220, 78: 223, 79: 225, 80: 229,
    81: 231, 82: 234, 83: 236, 84: 240, 85: 243, 86: 246, 87: 248, 88: 253, 89: 255, 90: 258,
    91: 260, 92: 263, 93: 266, 94: 269, 95: 272, 96: 275, 97: 278, 98: 282, 99: 285, 100: 288,
    101: 290, 102: 293, 103: 296, 104: 300, 105: 303, 106: 306, 107: 309, 108: 312, 109: 314, 110: 318,
    111: 321, 112: 325, 113: 328, 114: 332, 115: 335, 116: 340, 117: 344, 118: 347, 119: 350, 120: 353,
    121: 355, 122: 358, 123: 361, 124: 363, 125: 366, 126: 369, 127: 372, 128: 376, 129: 379, 130: 382,
    131: 385, 132: 388, 133: 390, 134: 393, 135: 396, 136: 399, 137: 401, 138: 405, 139: 407, 140: 411,
    141: 414, 142: 417, 143: 419, 144: 422,
}
NEXT_KEY = 424  # 练习答案起始印刷页

doc = pymupdf.open(PDF)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

matrix = pymupdf.Matrix(1.6, 1.6)

summary = {}
for n in range(1, 145):
    start = START[n]
    end = START[n + 1] if n + 1 in START else NEXT_KEY
    d = OUT / str(n)
    d.mkdir(exist_ok=True)
    seq = 0
    for printed in range(start, end):
        idx = printed + OFFSET
        if idx >= doc.page_count:
            break
        seq += 1
        pix = doc[idx].get_pixmap(matrix=matrix, alpha=False)
        pix.save(str(d / f"page-{seq}.png"))
    if seq:
        summary[n] = seq

print("课号 -> 渲染页数")
for n in sorted(summary):
    print(f"  L{n:>3}: {summary[n]} 页")
print("有图的课数:", len(summary))
