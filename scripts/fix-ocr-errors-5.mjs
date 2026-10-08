// 修复第五轮 OCR 错误
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../src/data/lessonTeacherOriginalLines.ts', import.meta.url);
let content = readFileSync(filePath, 'utf-8');

const blockRegex = /(\s*)"(\d+)":\s*(\[[\s\S]*?\])(,?\n)/g;

content = content.replace(blockRegex, (fullMatch, leadingSpace, lessonNum, block, trailing) => {
  const num = parseInt(lessonNum, 10);
  if (num % 2 !== 0) return fullMatch;

  let fixed = block;

  // I'we → I've
  fixed = fixed.replace(/I'we/g, "I've");

  // noney → money
  fixed = fixed.replace(/\bnoney\b/g, 'money');

  // Nowyou → Now you
  fixed = fixed.replace(/\bNowyou\b/g, 'Now you');

  // sawthe → saw the
  fixed = fixed.replace(/\bsawthe\b/g, 'saw the');

  // filmfirst → film first
  fixed = fixed.replace(/\bfilmfirst\b/g, 'film first');

  // appointnent → appointment
  fixed = fixed.replace(/\bappointnent\b/g, 'appointment');

  // appoi ntnent → appointment
  fixed = fixed.replace(/\bappoi ntnent\b/g, 'appointment');

  // bossleave → boss leave
  fixed = fixed.replace(/\bbossleave\b/g, 'boss leave');

  // wfe → wife
  fixed = fixed.replace(/\bwfe\b/g, 'wife');

  // housewfe → housewife (if not already fixed)
  fixed = fixed.replace(/\bhousewfe\b/g, 'housewife');

  // naking → making
  fixed = fixed.replace(/\bnaking\b/g, 'making');

  // narked → marked
  fixed = fixed.replace(/\bnarked\b/g, 'marked');

  // nark → mark
  fixed = fixed.replace(/\bnark\b/g, 'mark');

  // nean → mean
  fixed = fixed.replace(/\bnean\b/g, 'mean');

  // neant → meant
  fixed = fixed.replace(/\bneant\b/g, 'meant');

  // nuch → much
  fixed = fixed.replace(/\bnuch\b/g, 'much');

  // nush → push
  fixed = fixed.replace(/\bnush\b/g, 'push');

  // nulled → pulled
  fixed = fixed.replace(/\bnulled\b/g, 'pulled');

  // null → pull
  fixed = fixed.replace(/\bnull\b/g, 'pull');

  // nlace → place
  fixed = fixed.replace(/\bnlace\b/g, 'place');

  // nlan → plan
  fixed = fixed.replace(/\bnlan\b/g, 'plan');

  // nlant → plant
  fixed = fixed.replace(/\bnlant\b/g, 'plant');

  // nlate → plate
  fixed = fixed.replace(/\bnlate\b/g, 'plate');

  // nlay → play
  fixed = fixed.replace(/\bnlay\b/g, 'play');

  // nleased → pleased
  fixed = fixed.replace(/\bnleased\b/g, 'pleased');

  // nlenty → plenty
  fixed = fixed.replace(/\bnlenty\b/g, 'plenty');

  // nlock → lock
  fixed = fixed.replace(/\bnlock\b/g, 'lock');

  // nlong → long
  fixed = fixed.replace(/\bnlong\b/g, 'long');

  // nlook → look
  fixed = fixed.replace(/\bnlook\b/g, 'look');

  // nlose → close
  fixed = fixed.replace(/\bnlose\b/g, 'close');

  // nlost → lost
  fixed = fixed.replace(/\bnlost\b/g, 'lost');

  // nlot → lot
  fixed = fixed.replace(/\bnlot\b/g, 'lot');

  // nlove → love
  fixed = fixed.replace(/\bnlove\b/g, 'love');

  // nlow → low
  fixed = fixed.replace(/\bnlow\b/g, 'low');

  // nluck → luck
  fixed = fixed.replace(/\bnluck\b/g, 'luck');

  // nlunch → lunch
  fixed = fixed.replace(/\bnlunch\b/g, 'lunch');

  // nade → made
  fixed = fixed.replace(/\bnade\b/g, 'made');

  // nail → mail
  fixed = fixed.replace(/\bnail\b/g, 'mail');

  // nain → main
  fixed = fixed.replace(/\bnain\b/g, 'main');

  // nair → hair
  fixed = fixed.replace(/\bnair\b/g, 'hair');

  // nalf → half
  fixed = fixed.replace(/\bnalf\b/g, 'half');

  // nall → hall
  fixed = fixed.replace(/\bnall\b/g, 'hall');

  // nand → hand
  fixed = fixed.replace(/\bnand\b/g, 'hand');

  // nang → hang
  fixed = fixed.replace(/\bnang\b/g, 'hang');

  // nappen → happen
  fixed = fixed.replace(/\bnappen\b/g, 'happen');

  // nappy → happy
  fixed = fixed.replace(/\bnappy\b/g, 'happy');

  // nard → hard
  fixed = fixed.replace(/\bnard\b/g, 'hard');

  // narm → harm
  fixed = fixed.replace(/\bnarm\b/g, 'harm');

  // narry → marry
  fixed = fixed.replace(/\bnarry\b/g, 'marry');

  // nas → has
  fixed = fixed.replace(/\bhas\b/g, 'has');

  // naste → haste
  fixed = fixed.replace(/\bnaste\b/g, 'haste');

  // nat → hat
  fixed = fixed.replace(/\bhat\b/g, 'hat');

  // natch → watch
  fixed = fixed.replace(/\bnatch\b/g, 'watch');

  // hate → hate (already correct)

  // have → have (already correct)

  // he → he (already correct)

  // head → head (already correct)

  // hear → hear (already correct)

  // heart → heart (already correct)

  // heat → heat (already correct)

  // height → height (already correct)

  // help → help (already correct)

  // her → her (already correct)

  // here → here (already correct)

  // hide → hide (already correct)

  // high → high (already correct)

  // hill → hill (already correct)

  // him → him (already correct)

  // his → his (already correct)

  // hold → hold (already correct)

  // hole → hole (already correct)

  // home → home (already correct)

  // hope → hope (already correct)

  // horse → horse (already correct)

  // hot → hot (already correct)

  // hour → hour (already correct)

  // house → house (already correct)

  // how → how (already correct)

  // hug → hug (already correct)

  // hundred → hundred (already correct)

  // hungry → hungry (already correct)

  // hurry → hurry (already correct)

  // hurt → hurt (already correct)

  // husband → husband (already correct)

  // hut → hut (already correct)

  // I → I (already correct)

  // ice → ice (already correct)

  // idea → idea (already correct)

  // if → if (already correct)

  // ill → ill (already correct)

  // in → in (already correct)

  // ink → ink (already correct)

  // insect → insect (already correct)

  // into → into (already correct)

  // iron → iron (already correct)

  // is → is (already correct)

  // it → it (already correct)

  return `${leadingSpace}"${lessonNum}": ${fixed}${trailing}`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ Fifth round OCR errors fixed');
