"""把《剑桥初级英语语法(第3版中文)》对应单元页渲染成截图。

- Unit N 起始 PDF 页 = 20 + (N-1)*2（Unit 1 = PDF 第20页，每页一面，一个单元跨2页）。
- 映射：每课语法点 → 相关单元号。偶数课继承前一奇数课。
- 输出：src/assets/grammar-cambridge/<课号>/page-*.png
"""
import os
import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/剑桥初级英语语法_第3版中文.pdf"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "grammar-cambridge")

# 奇数课 -> 剑桥语法单元号列表（偶数课自动继承）
ODD = {
    1: [1, 74],      # This is my / Is this your, am is are, this/that
    3: [1, 43],      # 否定句 am is are not
    5: [65, 69],     # a/an
    7: [1, 2],       # am/is/are 及一般疑问句
    9: [47],         # How 特殊疑问句
    11: [60, 61, 64],# Whose, 名词所有格
    13: [47],        # What colour
    15: [66],        # 名词复数
    17: [66],        # 名词复数
    19: [37],        # there is/are
    21: [59, 96],    # give me, 宾格代词
    23: [47, 106],   # Where, 地点介词
    25: [37],
    27: [37],
    29: [35],        # 祈使句
    31: [3, 4],      # 现在进行时
    33: [3],
    35: [3],
    37: [3],
    39: [35],
    41: [76, 77],    # some/any
    43: [30],        # can
    45: [30],
    47: [5, 6, 7],   # 一般现在时
    49: [5],
    51: [5],
    53: [5],
    55: [5, 6],
    57: [5],
    59: [5],
    61: [31],        # must
    63: [31],
    65: [31],
    67: [26],        # be going to
    69: [11, 12],    # 一般过去时
    71: [11],
    73: [11],
    75: [11],
    77: [11, 12],
    79: [31],
    81: [58],        # have
    83: [15, 16],    # 现在完成时
    85: [15],
    87: [15],
    89: [15],
    91: [27, 28],    # will/shall 将来时
    93: [27],
    95: [33],        # have to
    97: [60, 61],
    99: [99],        # if
    101: [15],
    103: [29],       # might
    105: [53],       # want sb to do
    107: [91, 92],   # enough / too
    109: [34],       # would like
    111: [87, 88, 90],# 比较级最高级
    113: [42],       # so/neither
    115: [78, 79],   # something/anything
    117: [13, 14],   # 过去进行时
    119: [11],
    121: [101],      # 定语从句
    123: [101],
    125: [33],
    127: [29, 30],
    129: [31],
    131: [29],
    133: [50],       # 间接引语
    135: [50],
    137: [99],
    139: [50],
    141: [21],       # 被动语态
    143: [21],
}

def lesson_units(n: int):
    if n in ODD:
        return ODD[n]
    # 偶数课继承前一奇数课
    prev = n - 1
    return ODD.get(prev, [])

def main():
    doc = pymupdf.open(PDF)
    rendered = 0
    for lesson in range(1, 145):
        units = lesson_units(lesson)
        if not units:
            continue
        d = os.path.join(OUT, str(lesson))
        os.makedirs(d, exist_ok=True)
        seq = 0
        for u in units:
            for off in (0, 1):
                pg = 20 + (u - 1) * 2 + off
                pix = doc[pg].get_pixmap(dpi=130)
                seq += 1
                pix.save(os.path.join(d, f"page-{seq:02d}.png"))
                rendered += 1
    print(f"rendered {rendered} pages")

if __name__ == "__main__":
    main()
