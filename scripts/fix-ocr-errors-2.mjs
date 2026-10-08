// 修复剩余的 OCR 错误
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../src/data/lessonTeacherOriginalLines.ts', import.meta.url);
let content = readFileSync(filePath, 'utf-8');

// 仅对偶数课的内容块做替换
const blockRegex = /(\s*)"(\d+)":\s*(\[[\s\S]*?\])(,?\n)/g;

content = content.replace(blockRegex, (fullMatch, leadingSpace, lessonNum, block, trailing) => {
  const num = parseInt(lessonNum, 10);
  if (num % 2 !== 0) return fullMatch;

  let fixed = block;

  // Nunber21 → Number 21 (数字前没有空格)
  fixed = fixed.replace(/Nunber(\d)/g, 'Number $1');

  // I'mgoing → I'm going
  fixed = fixed.replace(/I'mgoing/g, "I'm going");

  // tel evisi on → television (不同间距)
  fixed = fixed.replace(/tel evisi on/g, 'television');

  // tonatoes → tomatoes
  fixed = fixed.replace(/\btonatoes\b/g, 'tomatoes');

  // themoff → them off
  fixed = fixed.replace(/\bthemoff\b/g, 'them off');

  // themon → them on
  fixed = fixed.replace(/\bthemon\b/g, 'them on');

  // Tomlike → Tom like
  fixed = fixed.replace(/\bTomlike\b/g, 'Tom like');

  // be doesn't → he doesn't
  fixed = fixed.replace(/\bbe doesn't\b/g, "he doesn't");

  // Qur → Our
  fixed = fixed.replace(/\bQur\b/g, 'Our');

  // Ween → When
  fixed = fixed.replace(/\bWeen\b/g, 'When');

  // Were do → Where do
  fixed = fixed.replace(/\bWere do\b/g, 'Where do');

  // Were does → Where does
  fixed = fixed.replace(/\bWere does\b/g, 'Where does');

  // fron? → from?
  fixed = fixed.replace(/\bfron\?/g, 'from?');

  // frombolland → from Holland
  fixed = fixed.replace(/frombolland/g, 'from Holland');

  // fromHoll and → from Holland
  fixed = fixed.replace(/fromHoll and/g, 'from Holland');

  // fromGernany → from Germany
  fixed = fixed.replace(/fromGernany/g, 'from Germany');

  // fromEngl and → from England
  fixed = fixed.replace(/fromEngl and/g, 'from England');

  // fromthe → from the
  fixed = fixed.replace(/fromthe/g, 'from the');

  // from) apan → from Japan
  fixed = fixed.replace(/from\) apan/g, 'from Japan');

  // fromN geria → from Nigeria
  fixed = fixed.replace(/fromN geria/g, 'from Nigeria');

  // fromFinl and → from Finland
  fixed = fixed.replace(/fromFinl and/g, 'from Finland');

  // fromChina → from China (already correct, but check spacing)
  fixed = fixed.replace(/fromChina/g, 'from China');

  // fromGreece → from Greece (already correct, but check spacing)
  fixed = fixed.replace(/fromGreece/g, 'from Greece');

  // fromItaly → from Italy (already correct, but check spacing)
  fixed = fixed.replace(/fromItaly/g, 'from Italy');

  // fromFrance → from France (already correct, but check spacing)
  fixed = fixed.replace(/fromFrance/g, 'from France');

  // from Australia (already correct)
  // from there → from there (already correct)

  // Ve → We
  fixed = fixed.replace(/\bVe\b/g, 'We');

  // W're → We're (already handled, but check)

  // one o'clock (already correct)

  // My. 25th → May 25th
  fixed = fixed.replace(/My\. (\d+)/g, 'May $1');

  // They'! llplay → They'll play
  fixed = fixed.replace(/They'! llplay/g, "They'll play");

  // they'! ll → they'll
  fixed = fixed.replace(/they'! ll/g, "they'll");

  // they'l! → they'll
  fixed = fixed.replace(/they'l!/g, "they'll");

  // tonvrrow → tomorrow
  fixed = fixed.replace(/\btonvrrow\b/g, 'tomorrow');

  // tonwrrow → tomorrow
  fixed = fixed.replace(/\btonwrrow\b/g, 'tomorrow');

  // wth → with
  fixed = fixed.replace(/\bwth\b/g, 'with');

  // Whose will → What will
  fixed = fixed.replace(/\bWhose will\b/g, 'What will');

  // if they cone hone → if they come home
  fixed = fixed.replace(/cone hone/g, 'come home');

  // cone from → come from
  fixed = fixed.replace(/cone from/g, 'come from');

  // cone when → come when
  fixed = fixed.replace(/cone when/g, 'come when');

  // cone wth → come with
  fixed = fixed.replace(/cone wth/g, 'come with');

  // cone tonorrow → come tomorrow
  fixed = fixed.replace(/cone tonorrow/g, 'come tomorrow');

  // at hone → at home
  fixed = fixed.replace(/at hone/g, 'at home');

  // sone neat → some meat
  fixed = fixed.replace(/sone neat/g, 'some meat');

  // any neat → any meat
  fixed = fixed.replace(/any neat/g, 'any meat');

  return `${leadingSpace}"${lessonNum}": ${fixed}${trailing}`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ Remaining OCR errors fixed');
