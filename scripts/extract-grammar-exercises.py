"""OCR 语法练习 PDF，把每课练习解析成可输入的填空/改写项，输出 lessonGrammarExercises.ts。

策略（扫描版无文字层）：
- 答案页（印刷页 424 起，干净排版）OCR 后按 "Lesson N" 切块，提取每条编号答案。
- 练习页 OCR 后提取编号题干句子（去掉括号内提示词）。
- 每课项 = { prompt, answer }，尽力按编号对齐；对齐不上的项仍保留题干、答案留空。
注意：OCR 有噪声，生成结果需人工抽检。
"""
import re, subprocess, tempfile, json
from pathlib import Path
import pymupdf

PDF = "/Users/jason.yang/Desktop/个人文件夹/学习/英语/新概念/新概念英语1语法练习.pdf"
PROJ = Path("/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice")
TMP = Path(tempfile.mkdtemp())
OFFSET = 13

START = {1:1,2:3,3:5,4:8,5:10,6:14,7:16,8:20,9:23,10:26,11:28,12:31,13:33,14:35,15:38,16:41,17:44,18:47,19:50,20:53,21:55,22:57,23:60,24:64,25:67,26:70,27:73,28:77,29:80,30:83,31:85,32:88,33:91,34:93,35:95,36:98,37:100,38:103,39:106,40:110,41:114,42:117,43:119,44:123,45:126,46:129,47:131,48:134,49:136,50:139,51:142,52:145,53:148,54:151,55:154,56:157,57:159,58:162,59:166,60:169,61:172,62:176,63:179,64:182,65:184,66:187,67:189,68:193,69:195,70:199,71:202,72:205,73:208,74:212,75:214,76:218,77:220,78:223,79:225,80:229,81:231,82:234,83:236,84:240,85:243,86:246,87:248,88:253,89:255,90:258,91:260,92:263,93:266,94:269,95:272,96:275,97:278,98:282,99:285,100:288,101:290,102:293,103:296,104:300,105:303,106:306,107:309,108:312,109:314,110:318,111:321,112:325,113:328,114:332,115:335,116:340,117:344,118:347,119:350,120:353,121:355,122:358,123:361,124:363,125:366,126:369,127:372,128:376,129:379,130:382,131:385,132:388,133:390,134:393,135:396,136:399,137:401,138:405,139:407,140:411,141:414,142:417,143:419,144:422}
NEXT_KEY = 424

doc = pymupdf.open(PDF)

def ocr(idx, scale=2.2):
    pix = doc[idx].get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
    f = TMP / f"p{idx}.png"
    pix.save(str(f))
    out = TMP / f"p{idx}"
    subprocess.run(["tesseract", str(f), str(out), "-l", "eng"],
                   check=True, capture_output=True)
    return (TMP / f"p{idx}.txt").read_text(errors="ignore")

# ---- 1) 答案 key：OCR 所有答案页，切出每课编号答案 ----
key_pages = list(range(NEXT_KEY + OFFSET, doc.page_count))
key_text = "\n".join(ocr(i, scale=3.0) for i in key_pages)
# split by Lesson N
blocks = re.split(r"Lesson\s+(\d+)", key_text)
# blocks[0] is header, then pairs (num, text)
answers: dict[int, list[str]] = {}
for i in range(1, len(blocks), 2):
    n = int(blocks[i])
    body = blocks[i+1] if i+1 < len(blocks) else ""
    # stop at next "Lesson" already split; extract numbered items
    parts = re.split(r"(?:^|\s)(\d+)[\.\)]\s+", body)
    # parts: [pre, num, text, num, text, ...]
    items = []
    for j in range(1, len(parts)-1, 2):
        items.append((int(parts[j]), parts[j+1].strip()))
    answers[n] = [a for _, a in items]

# ---- 2) 每课练习页：OCR，提取编号题干 ----
def parse_prompts(text):
    # join continuation lines, keep lines starting with "N."
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    items = []
    for l in lines:
        m = re.match(r"^(\d+)[\.\)]\s+(.*)", l)
        if m:
            num, rest = int(m.group(1)), m.group(2)
            # drop section headers / labels
            if re.match(r"^[IVX]+\.?$", rest): continue
            items.append((num, rest))
    return items

result: dict[int, list[dict]] = {}
for n in range(1, 145):
    start = START[n]
    end = START[n+1] if n+1 in START else NEXT_KEY
    text = "\n".join(ocr(p + OFFSET) for p in range(start, end))
    prompts = parse_prompts(text)
    ans = answers.get(n, [])
    rows = []
    for num, p in prompts:
        a = ans[num-1] if num-1 < len(ans) else ""
        rows.append({"prompt": p, "answer": a})
    if rows:
        result[n] = rows

# ---- 3) write TS ----
out = PROJ / "src/data/lessonGrammarExercises.ts"
lines = ["// 由 scripts/extract-grammar-exercises.py 从语法练习 PDF OCR 生成，需人工抽检。",
         "export interface GrammarExerciseItem { prompt: string; answer: string; }",
         "export const lessonGrammarExercises: Record<number, GrammarExerciseItem[]> = {"]
for n in sorted(result):
    rows = result[n]
    lines.append(f"  {n}: [")
    for r in rows:
        p = json.dumps(r["prompt"])
        a = json.dumps(r["answer"])
        lines.append(f"    {{ prompt: {p}, answer: {a} }},")
    lines.append("  ],")
lines.append("};")
out.write_text("\n".join(lines), encoding="utf-8")
total = sum(len(v) for v in result.values())
print(f"课数: {len(result)}, 总题数: {total}")
print("L1:", result.get(1))
print("L131:", result.get(131, [])[:5])
