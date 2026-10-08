// 修复第四轮 OCR 错误
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../src/data/lessonTeacherOriginalLines.ts', import.meta.url);
let content = readFileSync(filePath, 'utf-8');

const blockRegex = /(\s*)"(\d+)":\s*(\[[\s\S]*?\])(,?\n)/g;

content = content.replace(blockRegex, (fullMatch, leadingSpace, lessonNum, block, trailing) => {
  const num = parseInt(lessonNum, 10);
  if (num % 2 !== 0) return fullMatch;

  let fixed = block;

  // Tomand → Tom and
  fixed = fixed.replace(/\bTomand\b/g, 'Tom and');

  // AmI → Am I
  fixed = fixed.replace(/\bAmI\b/g, 'Am I');

  // WII → Will
  fixed = fixed.replace(/\bWII\b/g, 'Will');

  // Mery → Mary
  fixed = fixed.replace(/\bMery\b/g, 'Mary');

  // ve → we (谨慎：只在独立出现时替换)
  fixed = fixed.replace(/\bve\b/g, 'we');

  // do in the morning (already fixed)

  // (3)T The → (3)T: The
  fixed = fixed.replace(/\(3\)T The/g, '(3)T: The');

  // 4 7: → T:
  fixed = fixed.replace(/\b4 7:/g, 'T:');

  // 4T7: → T:
  fixed = fixed.replace(/\b4T7:/g, 'T:');

  // 77: → T:
  fixed = fixed.replace(/\b77:/g, 'T:');

  // 7 7T: → T:
  fixed = fixed.replace(/\b7 7T:/g, 'T:');

  // (l) → (1)
  fixed = fixed.replace(/\(l\)/g, '(1)');

  return `${leadingSpace}"${lessonNum}": ${fixed}${trailing}`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ Fourth round OCR errors fixed');
