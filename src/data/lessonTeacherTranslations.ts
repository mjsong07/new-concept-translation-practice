import type { ExerciseItem } from "../types/practice";

interface TeacherTranslationPair {
  original: string;
  translation: string;
}

// 已录入偶数课教师原文的逐句中译。原文顺序与译文一一对应；未录入课程不生成伪译文。
const lessonTeacherTranslationPairs: Record<number, TeacherTranslationPair[]> = {
  14: [
    { original: "What colour's Steven's umbrella?", translation: "史蒂文的雨伞是什么颜色的？" },
    { original: "Is it brown?", translation: "是棕色的吗？" },
    { original: "It isn't brown.", translation: "它不是棕色的。" },
    { original: "It's black.", translation: "它是黑色的。" },
    { original: "What colour's Sophie's coat?", translation: "索菲的外套是什么颜色的？" },
    { original: "Is it white?", translation: "是白色的吗？" },
    { original: "It isn't white.", translation: "它不是白色的。" },
    { original: "It's grey.", translation: "它是灰色的。" },
    { original: "What colour's the boy's tie?", translation: "男孩的领带是什么颜色的？" },
    { original: "Is it yellow?", translation: "是黄色的吗？" },
    { original: "It isn't yellow.", translation: "它不是黄色的。" },
    { original: "It's orange.", translation: "它是橙色的。" },
    { original: "What colour's Paul's car?", translation: "保罗的汽车是什么颜色的？" },
    { original: "Is it red?", translation: "是红色的吗？" },
    { original: "It isn't red.", translation: "它不是红色的。" },
    { original: "It's blue.", translation: "它是蓝色的。" },
    { original: "What colour's Anna's blouse?", translation: "安娜的女式衬衫是什么颜色的？" },
    { original: "Is it orange?", translation: "是橙色的吗？" },
    { original: "It isn't orange.", translation: "它不是橙色的。" },
    { original: "It's yellow.", translation: "它是黄色的。" },
    { original: "What colour's Tim's shirt?", translation: "蒂姆的衬衫是什么颜色的？" },
    { original: "Is it blue?", translation: "是蓝色的吗？" },
    { original: "It isn't blue.", translation: "它不是蓝色的。" },
    { original: "It's white.", translation: "它是白色的。" },
    { original: "What colour's Steven's hat?", translation: "史蒂文的帽子是什么颜色的？" },
    { original: "Is it green and red?", translation: "是红绿相间的吗？" },
    { original: "It isn't green and red.", translation: "它不是红绿相间的。" },
    { original: "It's grey and black.", translation: "它是灰黑相间的。" },
    { original: "What colour's the woman's case?", translation: "那位女士的箱子是什么颜色的？" },
    { original: "Is it grey?", translation: "是灰色的吗？" },
    { original: "It isn't grey.", translation: "它不是灰色的。" },
    { original: "It's brown.", translation: "它是棕色的。" },
    { original: "What colour's Helen's dog?", translation: "海伦的狗是什么颜色的？" },
    { original: "Is it grey and black?", translation: "是灰黑相间的吗？" },
    { original: "It isn't grey and black.", translation: "它不是灰黑相间的。" },
    { original: "It's brown and white.", translation: "它是棕白相间的。" },
    { original: "What colour's Anna's carpet?", translation: "安娜的地毯是什么颜色的？" },
    { original: "Is it green?", translation: "是绿色的吗？" },
    { original: "It isn't green.", translation: "它不是绿色的。" },
    { original: "It's red.", translation: "它是红色的。" }
  ],
  16: [
    { original: "What colour are your tickets?", translation: "你们的票是什么颜色的？" },
    { original: "Are they white?", translation: "是白色的吗？" },
    { original: "Our tickets are not white.", translation: "我们的票不是白色的。" },
    { original: "They are yellow.", translation: "它们是黄色的。" },
    { original: "What colour are your pens?", translation: "你们的钢笔是什么颜色的？" },
    { original: "Are they red?", translation: "是红色的吗？" },
    { original: "Our pens are not red.", translation: "我们的钢笔不是红色的。" },
    { original: "They are blue.", translation: "它们是蓝色的。" },
    { original: "What colour are your passports?", translation: "你们的护照是什么颜色的？" },
    { original: "Are they blue?", translation: "是蓝色的吗？" },
    { original: "Our passports are not blue.", translation: "我们的护照不是蓝色的。" },
    { original: "They are green.", translation: "它们是绿色的。" },
    { original: "What colour are your handbags?", translation: "你们的手提包是什么颜色的？" },
    { original: "Are they grey?", translation: "是灰色的吗？" },
    { original: "Our handbags are not grey.", translation: "我们的手提包不是灰色的。" },
    { original: "They are white.", translation: "它们是白色的。" },
    { original: "What colour are your blouses?", translation: "你们的女式衬衫是什么颜色的？" },
    { original: "Are they orange?", translation: "是橙色的吗？" },
    { original: "Our blouses are not orange.", translation: "我们的女式衬衫不是橙色的。" },
    { original: "They are yellow.", translation: "它们是黄色的。" },
    { original: "What colour are your coats?", translation: "你们的外套是什么颜色的？" },
    { original: "Are they black?", translation: "是黑色的吗？" },
    { original: "Our coats are not black.", translation: "我们的外套不是黑色的。" },
    { original: "They are grey.", translation: "它们是灰色的。" },
    { original: "What colour are your dresses?", translation: "你们的连衣裙是什么颜色的？" },
    { original: "Are they brown?", translation: "是棕色的吗？" },
    { original: "Our dresses are not brown.", translation: "我们的连衣裙不是棕色的。" },
    { original: "They are green.", translation: "它们是绿色的。" },
    { original: "What colour are your shirts?", translation: "你们的衬衫是什么颜色的？" },
    { original: "Are they blue?", translation: "是蓝色的吗？" },
    { original: "Our shirts are not blue.", translation: "我们的衬衫不是蓝色的。" },
    { original: "They are white.", translation: "它们是白色的。" },
    { original: "What colour are your hats?", translation: "你们的帽子是什么颜色的？" },
    { original: "Are they green and red?", translation: "是红绿相间的吗？" },
    { original: "Our hats are not green and red.", translation: "我们的帽子不是红绿相间的。" },
    { original: "They are black and grey.", translation: "它们是黑灰相间的。" },
    { original: "What colour are your ties?", translation: "你们的领带是什么颜色的？" },
    { original: "Are they red?", translation: "是红色的吗？" },
    { original: "Our ties are not red.", translation: "我们的领带不是红色的。" },
    { original: "They are orange.", translation: "它们是橙色的。" }
  ]
};

export function getLessonTeacherTranslationItems(lessonNumber: number, lessonTitle: string): ExerciseItem[] {
  return (lessonTeacherTranslationPairs[lessonNumber] || []).map(({ original, translation }, index) => ({
    id: `lesson-${lessonNumber}-original-${index}`,
    lesson: lessonNumber,
    lessonTitle,
    kind: "sentence",
    mode: "translate",
    section: "ORIGINAL",
    speakerZh: "",
    speakerEn: "ORIGINAL",
    prompt: translation,
    answer: original
  }));
}

export function getLessonTeacherTranslationPairs(lessonNumber: number) {
  return lessonTeacherTranslationPairs[lessonNumber] || [];
}
