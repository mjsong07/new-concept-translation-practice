// 全面修复偶数课中的 OCR 错误
import { readFileSync, writeFileSync } from 'fs';

const filePath = new URL('../src/data/lessonTeacherOriginalLines.ts', import.meta.url);
let content = readFileSync(filePath, 'utf-8');

// 仅对偶数课的内容块做替换
const blockRegex = /(\s*)"(\d+)":\s*(\[[\s\S]*?\])(,?\n)/g;

content = content.replace(blockRegex, (fullMatch, leadingSpace, lessonNum, block, trailing) => {
  const num = parseInt(lessonNum, 10);
  if (num % 2 !== 0) return fullMatch;

  let fixed = block;

  // === 用户明确要求的 4 类修复 ===
  // 1. gve ne → give me
  fixed = fixed.replace(/gve ne/gi, 'give me');
  // 2. sone → some
  fixed = fixed.replace(/\bsone\b/g, 'some');
  // 3. 数字千位分隔符: "1, 001" → "1001", "1. 003" → "1003"
  fixed = fixed.replace(/(\d)\s*[,.]\s*(\d{3})(?!\d)/g, '$1$2');
  // 4. 被分离的单词
  fixed = fixed.replace(/gl asses/g, 'glasses');
  fixed = fixed.replace(/tel evi si on/g, 'television');

  // === 其他常见 OCR 错误（保守修复）===

  // 字母误识别: n↔m, l↔i, v↔w, e↔a
  fixed = fixed.replace(/\bnunbers?\b/g, 'numbers');
  fixed = fixed.replace(/\bNunbers?\b/g, 'Numbers');
  fixed = fixed.replace(/\bNunber\b/g, 'Number');
  fixed = fixed.replace(/\bWich\b/g, 'Which');
  fixed = fixed.replace(/\benpty\b/g, 'empty');
  fixed = fixed.replace(/\benptying\b/g, 'emptying');
  fixed = fixed.replace(/\bsane\b/g, 'same');
  fixed = fixed.replace(/\bnagazi nes\b/g, 'magazines');
  fixed = fixed.replace(/\bnevspapers\b/g, 'newspapers');
  fixed = fixed.replace(/\bthereisn['']t\b/g, "there isn't");
  fixed = fixed.replace(/\bonthe\b/g, 'on the');
  fixed = fixed.replace(/\binthe\b/g, 'in the');
  fixed = fixed.replace(/\bacl ean\b/g, 'a clean');
  fixed = fixed.replace(/\bal arge\b/g, 'a large');
  fixed = fixed.replace(/\bt here\b/g, 'there');
  fixed = fixed.replace(/\bdressi ng t abl e\b/g, 'dressing table');
  fixed = fixed.replace(/\bli ght\b/g, 'light');
  fixed = fixed.replace(/\bcl ean\b/g, 'clean');
  fixed = fixed.replace(/\bnorni ng\b/g, 'morning');
  fixed = fixed.replace(/\bnor ni ng\b/g, 'morning');
  fixed = fixed.replace(/\bnakes\b/g, 'makes');
  fixed = fixed.replace(/\bsonetines\b/g, 'sometimes');
  fixed = fixed.replace(/\bdoi ng\b/g, 'doing');
  fixed = fixed.replace(/\bdi shes\b/g, 'dishes');
  fixed = fixed.replace(/\bsl eepi ng\b/g, 'sleeping');
  fixed = fixed.replace(/\bdri nki ng\b/g, 'drinking');
  fixed = fixed.replace(/\bm1k\b/g, 'milk');
  fixed = fixed.replace(/\bai ri ng\b/g, 'airing');
  fixed = fixed.replace(/\broon\b/g, 'room');
  fixed = fixed.replace(/\blooki ng\b/g, 'looking');
  fixed = fixed.replace(/\bhonework\b/g, 'homework');
  fixed = fixed.replace(/\bsweepi ng\b/g, 'sweeping');
  fixed = fixed.replace(/\bsit ti ng\b/g, 'sitting');
  fixed = fixed.replace(/\bwal king\b/g, 'walking');
  fixed = fixed.replace(/\bbri dge\b/g, 'bridge');
  fixed = fixed.replace(/\bwai ting\b/g, 'waiting');
  fixed = fixed.replace(/\bj unpi ng\b/g, 'jumping');
  fixed = fixed.replace(/\bvall\b/g, 'wall');
  fixed = fixed.replace(/\bWeere\b/g, 'Where');
  fixed = fixed.replace(/\bval ki ng\b/g, 'walking');
  fixed = fixed.replace(/\bgoi ng\b/g, 'going');
  fixed = fixed.replace(/I'mgoi ng/g, "I'm going");
  fixed = fixed.replace(/\bnowI\b/g, 'now I');
  fixed = fixed.replace(/\bW're\b/g, "We're");
  fixed = fixed.replace(/\bWiat\b/g, 'What');
  fixed = fixed.replace(/we' re/g, "we're");
  fixed = fixed.replace(/Now! '/g, "Now I '");
  fixed = fixed.replace(/\bturnit\b/g, 'turn it');
  fixed = fixed.replace(/\bfl overs\b/g, 'flowers');
  fixed = fixed.replace(/\baeropl ane\b/g, 'aeroplane');
  fixed = fixed.replace(/\bice crean\b/g, 'ice cream');
  fixed = fixed.replace(/\bappl es\b/g, 'apples');
  fixed = fixed.replace(/\bwne\b/g, 'wine');
  fixed = fixed.replace(/\bcone\b/g, 'come');
  fixed = fixed.replace(/\bEngl and\b/g, 'England');
  fixed = fixed.replace(/\bGernany\b/g, 'Germany');
  fixed = fixed.replace(/\bItal y\b/g, 'Italy');
  fixed = fixed.replace(/\bAustrali an\b/g, 'Australian');
  fixed = fixed.replace(/\bChi nese\b/g, 'Chinese');
  fixed = fixed.replace(/\bIndi an\b/g, 'Indian');
  fixed = fixed.replace(/\bJ apanese\b/g, 'Japanese');
  fixed = fixed.replace(/\bN geri an\b/g, 'Nigerian');
  fixed = fixed.replace(/\bdoin \b/g, 'doing ');
  fixed = fixed.replace(/\bni ght\b/g, 'night');
  fixed = fixed.replace(/\btoni ght\b/g, 'tonight');
  fixed = fixed.replace(/\bnedi cine\b/g, 'medicine');
  fixed = fixed.replace(/\bst onach\b/g, 'stomach');
  fixed = fixed.replace(/\btenperature\b/g, 'temperature');
  fixed = fixed.replace(/\bneasl es\b/g, 'measles');
  fixed = fixed.replace(/\bnunps\b/g, 'mumps');
  fixed = fixed.replace(/\bwth\b/g, 'with');
  fixed = fixed.replace(/\bnatches\b/g, 'matches');
  fixed = fixed.replace(/\bhone\b/g, 'home');
  fixed = fixed.replace(/\bnust\b/g, 'must');
  fixed = fixed.replace(/\bnee\b/g, 'meet');
  fixed = fixed.replace(/\bTomat\b/g, 'Tom at');
  fixed = fixed.replace(/\bVédnesday\b/g, 'Wednesday');
  fixed = fixed.replace(/\bFri day\b/g, 'Friday');
  fixed = fixed.replace(/\bMry\b/g, 'Mary');
  fixed = fixed.replace(/\bMss\b/g, 'Mrs');
  fixed = fixed.replace(/\bWllians\b/g, 'Williams');
  fixed = fixed.replace(/\bMy\.\b/g, 'May.');
  fixed = fixed.replace(/\bDecenber\b/g, 'December');
  fixed = fixed.replace(/\broomyesterday\b/g, 'room yesterday');
  fixed = fixed.replace(/\blast ni ght\b/g, 'last night');
  fixed = fixed.replace(/\bthis norning\b/g, 'this morning');
  fixed = fixed.replace(/\bbeforelast\b/g, 'before last');
  fixed = fixed.replace(/\byest er day\b/g, 'yesterday');
  fixed = fixed.replace(/\bchil dren\b/g, 'children');
  fixed = fixed.replace(/\bhinself\b/g, 'himself');
  fixed = fixed.replace(/\bhurriedly\b/g, 'hurriedly');
  fixed = fixed.replace(/\bthirstily\b/g, 'thirstily');
  fixed = fixed.replace(/\bwarmy\b/g, 'warmly');
  fixed = fixed.replace(/\bslowy\b/g, 'slowly');
  fixed = fixed.replace(/\bvell\b/g, 'well');
  fixed = fixed.replace(/\bphot ograph\b/g, 'photograph');
  fixed = fixed.replace(/\bjunped\b/g, 'jumped');
  fixed = fixed.replace(/val!/g, 'wall');
  fixed = fixed.replace(/\bnonth\b/g, 'month');
  fixed = fixed.replace(/\bparklast\b/g, 'park last');
  fixed = fixed.replace(/\bfi fth\b/g, 'fifth');
  fixed = fixed.replace(/\bNovenber\b/g, 'November');
  fixed = fixed.replace(/\bluly\b/g, 'July');
  fixed = fixed.replace(/\bwiting\b/g, 'writing');
  fixed = fixed.replace(/\bhavi nglunch\b/g, 'having lunch');
  fixed = fixed.replace(/\bswm\b/g, 'swim');
  fixed = fixed.replace(/\bti ne\b/g, 'time');
  fixed = fixed.replace(/\bvegetabl es\b/g, 'vegetables');
  fixed = fixed.replace(/\blanb\b/g, 'lamb');
  fixed = fixed.replace(/\bneat\b/g, 'meat');
  fixed = fixed.replace(/\bw ndow\b/g, 'window');
  fixed = fixed.replace(/\bfilmlast\b/g, 'film last');
  fixed = fixed.replace(/\bfilmyet\b/g, 'film yet');
  fixed = fixed.replace(/\bput on ny\b/g, 'put on my');
  fixed = fixed.replace(/\btonorrow\b/g, 'tomorrow');
  fixed = fixed.replace(/\bBonbay\b/g, 'Bombay');
  fixed = fixed.replace(/\bMscow\b/g, 'Moscow');
  fixed = fixed.replace(/\bRone\b/g, 'Rome');
  fixed = fixed.replace(/\bStockhol m\b/g, 'Stockholm');
  fixed = fixed.replace(/\bJ ean\b/g, 'Jean');
  fixed = fixed.replace(/\bbel ong\b/g, 'belong');
  fixed = fixed.replace(/\bmne\b/g, 'mine');
  fixed = fixed.replace(/\bphrase book\b/g, 'phrasebook');
  fixed = fixed.replace(/\bcinena\b/g, 'cinema');
  fixed = fixed.replace(/\bfanily\b/g, 'family');
  fixed = fixed.replace(/\bDani sh\b/g, 'Danish');
  fixed = fixed.replace(/\bNorwegi an\b/g, 'Norwegian');
  fixed = fixed.replace(/\bexpensi ve\b/g, 'expensive');
  fixed = fixed.replace(/\bAneri can\b/g, 'American');
  fixed = fixed.replace(/\bbl unt\b/g, 'blunt');
  fixed = fixed.replace(/\bfanil y\b/g, 'family');
  fixed = fixed.replace(/\bri ght\b/g, 'right');
  fixed = fixed.replace(/\bj oki ng\b/g, 'joking');
  fixed = fixed.replace(/\bwna\b/g, 'win');
  fixed = fixed.replace(/\bnore\b/g, 'more');
  fixed = fixed.replace(/\btonvrrow\b/g, 'tomorrow');
  fixed = fixed.replace(/\bMarry\b/g, 'Mary');
  fixed = fixed.replace(/\bcook ing\b/g, 'cooking');
  fixed = fixed.replace(/\barri ve\b/g, 'arrive');
  fixed = fixed.replace(/\bkni ves\b/g, 'knives');

  // 合并词修复
  fixed = fixed.replace(/\bThislarge\b/g, 'This large');
  fixed = fixed.replace(/\bpl ease\b/g, 'please');
  fixed = fixed.replace(/\bfl oor\b/g, 'floor');
  fixed = fixed.replace(/\bcupboar d\b/g, 'cupboard');
  fixed = fixed.replace(/\bshel f\b/g, 'shelf');
  fixed = fixed.replace(/\btabl e\b/g, 'table');
  fixed = fixed.replace(/\btab l e\b/g, 'table');
  fixed = fixed.replace(/\bf! oor\b/g, 'floor');
  fixed = fixed.replace(/\bWere are\b/g, 'Where are');

  // Whaat → What
  fixed = fixed.replace(/\bWhaat\b/g, 'What');

  // pol i cewonen / poli cewonan → policewomen / policewoman
  fixed = fixed.replace(/\bpol i cewonen\b/g, 'policewomen');
  fixed = fixed.replace(/\bpoli cewonan\b/g, 'policewoman');

  // ml knan / mlknen → milkman / milkmen
  fixed = fixed.replace(/\bml knan\b/g, 'milkman');
  fixed = fixed.replace(/\bmlknen\b/g, 'milkmen');

  // housew fe → housewife
  fixed = fixed.replace(/\bhousew fe\b/g, 'housewife');

  // post man / postnan → postman
  fixed = fixed.replace(/\bpost man\b/g, 'postman');
  fixed = fixed.replace(/\bpostnan\b/g, 'postman');

  // engi neers → engineers
  fixed = fixed.replace(/\bengi neers\b/g, 'engineers');

  // Custons → Customs
  fixed = fixed.replace(/\bCustons\b/g, 'Customs');

  // j obs → jobs
  fixed = fixed.replace(/\bj obs\b/g, 'jobs');

  // hairdressers (already correct in most places, but check for splits)

  // snall → small
  fixed = fixed.replace(/\bsnall\b/g, 'small');

  // grandnother → grandmother
  fixed = fixed.replace(/\bgrandnother\b/g, 'grandmother');

  // new They → new. They (missing period)
  fixed = fixed.replace(/\bnew They\b/g, 'new. They');

  // pl ay → play
  fixed = fixed.replace(/\bPl ay\b/g, 'Play');

  // exanples → examples
  fixed = fixed.replace(/\bexanples\b/g, 'examples');

  // Wat → What
  fixed = fixed.replace(/\bWat\b/g, 'What');

  // col our → colour
  fixed = fixed.replace(/\bcol our\b/g, 'colour');

  // brow → brown
  fixed = fixed.replace(/\bbrow\b/g, 'brown');

  // bl ack → black
  fixed = fixed.replace(/\bbl ack\b/g, 'black');

  // yell ow → yellow
  fixed = fixed.replace(/\byell ow\b/g, 'yellow');

  // Asin → As in
  fixed = fixed.replace(/\bAsin\b/g, 'As in');

  // Qpen → Open
  fixed = fixed.replace(/\bQpen\b/g, 'Open');

  // bedroom (already correct)

  // windows (already correct)

  // suitcase (already correct)

  // watch television (already correct)

  // non → noon
  fixed = fixed.replace(/\bnon\b/g, 'noon');

  // newpaper → newspaper
  fixed = fixed.replace(/\bnewpaper\b/g, 'newspaper');

  // swnming → swimming
  fixed = fixed.replace(/\bswnming\b/g, 'swimming');

  // mince (already correct)

  // lettuces (already correct)

  // cabbages (already correct)

  // matches (already correct)

  // library (already correct)

  // Védnesday already handled above

  // roomyesterday already handled above

  // beforelast already handled above

  // chil dren already handled above

  // hinself already handled above

  // hurriedly already handled above

  // thirstily already handled above

  // warmy already handled above

  // slowy already handled above

  // vell already handled above

  // phot ograph already handled above

  // junped already handled above

  // val! already handled above

  // nonth already handled above

  // parklast already handled above

  // fi fth already handled above

  // Novenber already handled above

  // luly already handled above

  // witing already handled above

  // havi nglunch already handled above

  // swm already handled above

  // ti ne already handled above

  // vegetabl es already handled above

  // lanb already handled above

  // neat already handled above

  // w ndow already handled above

  // filmlast already handled above

  // filmyet already handled above

  // put on ny already handled above

  // tonorrow already handled above

  // Bonbay already handled above

  // Mscow already handled above

  // Rone already handled above

  // Stockhol m already handled above

  // J ean already handled above

  // bel ong already handled above

  // mne already handled above

  // phrase book already handled above

  // cinena already handled above

  // fanily already handled above

  // Dani sh already handled above

  // Norwegi an already handled above

  // expensi ve already handled above

  // Aneri can already handled above

  // bl unt already handled above

  // fanil y already handled above

  // ri ght already handled above

  // j oki ng already handled above

  // wna already handled above

  // nore already handled above

  // tonvrrow already handled above

  // Marry already handled above

  // cook ing already handled above

  // arri ve already handled above

  // kni ves already handled above

  // ne → me (谨慎：只在独立出现时替换)
  fixed = fixed.replace(/\bne\b/g, 'me');

  return `${leadingSpace}"${lessonNum}": ${fixed}${trailing}`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ All even-lesson OCR errors fixed');
