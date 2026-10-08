// 修复第三轮 OCR 错误
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../src/data/lessonTeacherOriginalLines.ts', import.meta.url);
let content = readFileSync(filePath, 'utf-8');

const blockRegex = /(\s*)"(\d+)":\s*(\[[\s\S]*?\])(,?\n)/g;

content = content.replace(blockRegex, (fullMatch, leadingSpace, lessonNum, block, trailing) => {
  const num = parseInt(lessonNum, 10);
  if (num % 2 !== 0) return fullMatch;

  let fixed = block;

  // cones from → comes from
  fixed = fixed.replace(/cones from/g, 'comes from');

  // fromAustria → from Austria
  fixed = fixed.replace(/fromAustria/g, 'from Austria');

  // fromIndi a → from India
  fixed = fixed.replace(/fromIndi a/g, 'from India');

  // fromCanada → from Canada
  fixed = fixed.replace(/fromCanada/g, 'from Canada');

  // fromTurkey → from Turkey
  fixed = fixed.replace(/fromTurkey/g, 'from Turkey');

  // cane from → came from
  fixed = fixed.replace(/\bcane from\b/g, 'came from');

  // norning → morning
  fixed = fixed.replace(/\bnorning\b/g, 'morning');

  // mlk → milk
  fixed = fixed.replace(/\bmlk\b/g, 'milk');

  // eveni ng → evening
  fixed = fixed.replace(/\beveni ng\b/g, 'evening');

  // neal → meal
  fixed = fixed.replace(/\bneal\b/g, 'meal');

  // amreading → am reading
  fixed = fixed.replace(/\bamreading\b/g, 'am reading');

  // W usually → We usually
  fixed = fixed.replace(/\bW usually\b/g, 'We usually');

  // W are → We are
  fixed = fixed.replace(/\bW are\b/g, 'We are');

  // W don't → We don't
  fixed = fixed.replace(/\bW don't\b/g, "We don't");

  // Tomhave → Tom have
  fixed = fixed.replace(/\bTomhave\b/g, 'Tom have');

  // doing the morning → do in the morning
  fixed = fixed.replace(/doing the morning/g, 'do in the morning');

  // 7. 0o'clock → 7 o'clock
  fixed = fixed.replace(/(\d)\.\s*0o'clock/g, "$1 o'clock");

  // 8. 0 o'clock → 8 o'clock
  fixed = fixed.replace(/(\d)\.\s*0\s+o'clock/g, "$1 o'clock");

  // dot hey → do they
  fixed = fixed.replace(/\bdot hey\b/g, 'do they');

  // doi nt he → do in the
  fixed = fixed.replace(/doi nt he/g, 'do in the');

  // aft er noon → afternoon
  fixed = fixed.replace(/\baft er noon\b/g, 'afternoon');

  // al ways → always
  fixed = fixed.replace(/\bal ways\b/g, 'always');

  // 17t hand 18t hpi ct ures → 17th and 18th pictures
  fixed = fixed.replace(/17t hand 18t hpi ct ures/g, '17th and 18th pictures');

  // Canadi an → Canadian
  fixed = fixed.replace(/\bCanadi an\b/g, 'Canadian');

  // Austrian (already correct)

  // Finnish (already correct)

  return `${leadingSpace}"${lessonNum}": ${fixed}${trailing}`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ Third round OCR errors fixed');
