"""一次性脚本：从课堂笔记 PDF 中按课号提取课堂笔记页并渲染为 PNG。

规则：
- 扫描每页首行，识别带课号的标题页（Words13 / Grammar31 / Words+Practices22 / Words23 24 ...）。
- 某奇数课 N 的参考页 = 从 N 的标题页开始，到下一个带课号标题页之前的所有非 Cornell 页。
- Cornell 空白作业页（Questions/Homework/Summary）不渲染。
- 输出到 src/assets/lesson-notes/<课号>/page-<序号>.png，并打印课号->页索引映射用于核对。
"""
import re
from pathlib import Path

import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/新概念英语+1+课堂笔记&课后练习.pdf"
OUT = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/assets/lesson-notes")

# App 中存在的奇数课
APP_LESSONS = set(range(1, 145, 2))

doc = pymupdf.open(PDF)

def page_lines(idx: int):
    t = doc[idx].get_text("text", sort=True)
    return [l.strip() for l in t.split("\n") if l.strip()], t

def is_cornell(first: str, length: int) -> bool:
    return length < 260 and first.startswith("Questions")

# 1) 找出所有带课号的标题页：(page_index, lesson_number)
headers = []  # (page_index_0based, num)
hdr_re = re.compile(r"(?:Words|Grammar|Practices|Story)(?:\s*\+\s*Practices)?\s*(\d+)")
for i in range(7, doc.page_count):
    lines, t = page_lines(i)
    first = lines[0] if lines else ""
    if is_cornell(first, len(t)):
        continue
    m = hdr_re.search(first)
    if m:
        headers.append((i, int(m.group(1))))

# 2) 对每个标题页课号 N，参考页 = [该页, 下一个标题页)，跳过 cornell
result = {}
for pos, (idx, num) in enumerate(headers):
    end = headers[pos + 1][0] if pos + 1 < len(headers) else doc.page_count
    pages = []
    for j in range(idx, end):
        lines, t = page_lines(j)
        first = lines[0] if lines else ""
        if is_cornell(first, len(t)):
            continue
        pages.append(j)
    if pages:
        # 同一课号可能多次出现（如 Words23 24），合并
        result.setdefault(num, []).extend(pages)

# 去重并保持顺序
for n in result:
    seen, out = set(), []
    for p in result[n]:
        if p not in seen:
            seen.add(p)
            out.append(p)
    result[n] = out

# 3) 渲染所有出现过的课号（含偶数课；偶数课若无独立标题页则继承前一个奇数课）
OUT.mkdir(parents=True, exist_ok=True)
matrix = pymupdf.Matrix(1.6, 1.6)  # 约 115 DPI，兼顾清晰度与体积

# 偶数课没有独立标题页时（如 88），继承前一个奇数课（87）的笔记页。
for even in range(2, 145, 2):
    if even not in result and (even - 1) in result:
        result[even] = result[even - 1]

rendered = {}
for n in sorted(result):
    if n < 1 or n > 144:
        continue
    d = OUT / str(n)
    d.mkdir(exist_ok=True)
    seq = 0
    for pidx in result[n]:
        seq += 1
        pix = doc[pidx].get_pixmap(matrix=matrix, alpha=False)
        pix.save(str(d / f"page-{seq}.png"))
    rendered[n] = result[n]

# 打印核对
print("课号 -> PDF页(1based)")
for n in sorted(rendered):
    print(f"  L{n:>3}: pages {[p+1 for p in rendered[n]]}")
print("渲染课数:", len(rendered))

# 4) 提取每课 homework 作业说明（每页底部 “homework” 虚线框内文字）
SECTION_HEADER = re.compile(r"^(Words|Grammar|Practices|Story|Comprehension|Asking questions|homework)")
CN_NUM = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10}

def cn_to_int(s: str):
    if s.isdigit():
        return int(s)
    if s in CN_NUM:
        return CN_NUM[s]
    if s.startswith("十"):
        return 10 + CN_NUM.get(s[1:], 0)
    if s.endswith("十"):
        return CN_NUM.get(s[:1], 0) * 10
    if "十" in s:
        a, b = s.split("十")
        return CN_NUM.get(a, 0) * 10 + CN_NUM.get(b, 0)
    return None

hw_lines_re = re.compile(r"第\s*(\d+|[一二三四五六七八九十]+)\s*课")

def page_homework_lines(idx: int, lesson_num: int):
    lines, _ = page_lines(idx)
    idxs = [i for i, l in enumerate(lines) if l == "homework"]
    if not idxs:
        return []
    out = []
    for l in lines[idxs[-1] + 1:]:
        if re.fullmatch(r"\d{1,3}", l):
            break
        if SECTION_HEADER.match(l):
            break
        out.append(l)
    kept = []
    for l in out:
        # 跳过 Cornell 笔记页标签行
        if "Summary & Recap" in l or re.match(r"^Questions\b", l):
            continue
        m = hw_lines_re.search(l)
        if m:
            ref = cn_to_int(m.group(1))
            if ref is not None and ref != lesson_num:
                continue
        kept.append(l)
    return kept

homework_map: dict[int, list[str]] = {}
for n, pages in rendered.items():
    seen, acc = set(), []
    for pidx in pages:
        for l in page_homework_lines(pidx, n):
            if l and l not in seen:
                seen.add(l)
                acc.append(l)
    if acc:
        homework_map[n] = acc

HW_FILE = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/data/lessonHomework.ts")
def ts_str(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')

lines_out = [
    "// 由 scripts/extract-notes-pdf.py 从课堂笔记 PDF 的 homework 虚线框提取，请勿手工修改。",
    "// key: 课号；value: 该课作业说明（按出现顺序，已去重）。",
    "export const lessonHomework: Record<number, string[]> = {",
]
for n in sorted(homework_map):
    items = ", ".join(f'"{ts_str(l)}"' for l in homework_map[n])
    lines_out.append(f"  {n}: [{items}],")
lines_out.append("};")
HW_FILE.write_text("\n".join(lines_out) + "\n", encoding="utf-8")

print("\n课号 -> homework 说明")
for n in sorted(homework_map):
    print(f"  L{n:>3}: {homework_map[n]}")
print("有作业说明的课数:", len(homework_map))

# 5) 把课堂笔记正文按类别切分：Words / Grammar / Comprehension / Asking questions / Story
#    用坐标分左右栏，每个类别块内“先读完左栏再读右栏”，保证题号 1..5 后接 6..10。
CAT_HEADER = re.compile(
    r"^(Words(?:\s*\+\s*Practices)?|Grammar|Practices|Story|Comprehension|Asking questions)\s*\d*$"
)
CAT_MAP = {"Words": "Words", "Words+Practices": "Words", "Grammar": "Grammar",
           "Practices": "Practices", "Story": "Story",
           "Comprehension": "Comprehension", "Asking questions": "Asking questions"}

def page_structured_lines(idx):
    """返回页面每行：{y, col('L'/'R'), text, size(该行最大字号)}。
    用 dict spans 取字号：≤7pt 是音标，直接丢弃；≥11pt 是单词头词。"""
    page = doc[idx]
    d = page.get_text("dict")
    mid = page.rect.width / 2
    toks = []
    for b in d.get("blocks", []):
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                txt = s["text"].strip()
                if not txt:
                    continue
                x0, y0 = s["bbox"][0], s["bbox"][1]
                size = round(s["size"])
                if size <= 7:
                    continue  # 音标字符，直接丢弃
                toks.append((x0, y0, txt, size))
    out = []
    for col in ("L", "R"):
        ts = [t for t in toks if (t[0] < mid) == (col == "L")]
        ts = sorted(ts, key=lambda t: (t[1], t[0]))
        clusters, cur, cy = [], [], None
        for tk in ts:
            y = round(tk[1] / 4)
            if cy is None or abs(y - cy) <= 1:
                cur.append(tk); cy = y if cy is None else cy
            else:
                clusters.append(cur); cur = [tk]; cy = y
        if cur:
            clusters.append(cur)
        for ln in clusters:
            ln = sorted(ln, key=lambda t: t[0])
            text = " ".join(t[2] for t in ln).strip()
            size = max(t[3] for t in ln)
            if text:
                out.append({"y": min(t[1] for t in ln), "col": col, "text": text, "size": size})
    return out

# 操练块里折行续句合并：T:/S: 问答被 PDF 折成两行时，把后续非“新条目”行并回上一行。
# 注意：无编号的 T:（如 Asking questions 里的 "T:When ... ?" 提示词）也算新条目，不并入回答。
DRILL = {"Comprehension", "Asking questions", "Practices"}
NEW_ITEM = re.compile(r"^(?:\d*\s*T\s*[:：]|S\s*[:：]|Asking questions\s*\d*$)")

def strip_markers(text: str) -> str:
    """去掉 T:/S: 前缀，保留编号；用 Q§/A§ 标记问答以便前端区分样式。"""
    m = re.match(r"^(\d*\s*)T\s*[:：]\s*(.*)", text)
    if m:
        return "Q§" + (m.group(1) + m.group(2)).strip()
    m = re.match(r"^S\s*[:：]\s*(.*)", text)
    if m:
        return "A§" + m.group(1).strip()
    return text

def reorder_asking_questions(lines):
    """Asking questions 每题：编号提问 -> 一般疑问回答 -> 无编号 T: 提示词(When/Why...) -> 特殊疑问回答。
    把无编号 Q§ 提示词移到编号提问正后方。"""
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if line.startswith("Q§") and line[2:3].isdigit():
            group = [line]
            i += 1
            rest = []
            while i < n and not (lines[i].startswith("Q§") and lines[i][2:3].isdigit()):
                if lines[i].startswith("Q§"):  # 无编号提示词，移到题目后
                    group.append(lines[i])
                else:
                    rest.append(lines[i])
                i += 1
            out.extend(group + rest)
        else:
            out.append(line)
            i += 1
    return out

def clean_block(cat, items):
    """items: [(page,col,y,text,size)] -> list[str]。"""
    lines = [it[3] for it in items]
    if cat == "Words":
        out_lines = []
        for (_, _, _, text, size) in items:
            if size >= 11:  # 单词头词：加粗，且与上一个单词之间空一行
                if out_lines:
                    out_lines.append("")
                out_lines.append("§" + text)
            else:
                out_lines.append(text)
        return out_lines
    if cat in DRILL:
        merged = []
        for text in lines:
            if merged and not NEW_ITEM.match(text) and NEW_ITEM.match(merged[-1]):
                merged[-1] = (merged[-1] + " " + text).strip()
            else:
                merged.append(text)
        stripped = [strip_markers(l) for l in merged]
        if cat == "Asking questions":
            stripped = reorder_asking_questions(stripped)
        return stripped
    return lines

def extract_content(pages):
    blocks: list[list] = []  # [category, items[(page,col,y,text,size)]]
    block_by_cat: dict[str, list] = {}
    def ensure(cat):
        if cat not in block_by_cat:
            blk = [cat, []]
            block_by_cat[cat] = blk
            blocks.append(blk)
        return block_by_cat[cat]
    for pnum, pidx in enumerate(pages):
        lines = page_structured_lines(pidx)
        events = []   # (y, category)
        content = []  # {y, col, text, size}
        # homework 虚线框在页面底部：丢弃其 y 及以下的所有行（与左右栏顺序无关）
        hw_y = next((ln["y"] for ln in lines if ln["text"] == "homework"), None)
        for ln in lines:
            t = ln["text"]
            if re.fullmatch(r"\d{1,3}", t):
                continue
            if hw_y is not None and ln["y"] >= hw_y:
                continue
            m = CAT_HEADER.match(t)
            if m:
                events.append((ln["y"], CAT_MAP[m.group(1)]))
            else:
                content.append(ln)
        events.sort(key=lambda e: e[0])
        for ln in content:
            cat = None
            for ey, ec in events:
                if ey <= ln["y"]:
                    cat = ec
                else:
                    break
            if cat is None:
                continue
            ensure(cat)[1].append((pnum, ln["col"], ln["y"], ln["text"], ln["size"]))
    # 每个块内：按页分组，页内先左栏(L)后右栏(R)，再按 y
    result = []
    for cat, items in blocks:
        items.sort(key=lambda it: (it[0], 0 if it[1] == "L" else 1, it[2]))
        texts = clean_block(cat, items)
        if texts:
            result.append([cat, texts])
    return result

content_map: dict[int, list] = {}
for n, pages in rendered.items():
    blocks = extract_content(pages)
    if blocks:
        content_map[n] = blocks

CONTENT_FILE = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice/src/data/lessonContent.ts")
out = [
    "// 由 scripts/extract-notes-pdf.py 从课堂笔记 PDF 提取的正文，按类别切分；请勿手工修改。",
    "// category: Words | Grammar | Practices | Comprehension | Asking questions | Story；lines 为该类别正文（已按左右栏顺序还原）。",
    "export interface LessonContentBlock { category: \"Words\" | \"Grammar\" | \"Practices\" | \"Comprehension\" | \"Asking questions\" | \"Story\"; lines: string[] }",
    "export const lessonContent: Record<number, LessonContentBlock[]> = {",
]
for n in sorted(content_map):
    parts = []
    for cat, lines in content_map[n]:
        items = ", ".join(f'"{ts_str(l)}"' for l in lines)
        parts.append(f'{{ category: "{cat}", lines: [{items}] }}')
    out.append(f"  {n}: [{', '.join(parts)}],")
out.append("};")
CONTENT_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")

print("\n课号 -> 内容类别")
for n in sorted(content_map):
    print(f"  L{n:>3}: {[(b[0], len(b[1])) for b in content_map[n]]}")
print("有内容的课数:", len(content_map))
