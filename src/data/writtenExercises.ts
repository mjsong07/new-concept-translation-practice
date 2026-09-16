import type { Lesson } from "../types/practice";

// 偶数课书面练习（Written exercises）。
// 数据来源：《新概念英语》第1册 PDF 第 132 页 Lesson 66。
// section: 对应教材 Written exercises 下的分区字母（A、B、C…），分区标题与例句见 sections。
// mode: 'fill' 表示根据例句填空（仅输入缺失词），'sentence' 表示根据例句写完整句子。
export const writtenExercises: Lesson[] = [
  {
    number: 66,
    title: "What's the time?",
    titleZh: "几点钟？",
    questionEn: "What's the time?",
    questionZh: "几点钟？",
    kind: "written",
    sections: [
      {
        key: "A",
        titleEn: "Complete these sentences using in, at or from.",
        titleZh: "用 in, at 或 from 完成以下句子。"
      },
      {
        key: "B",
        titleEn: "Answer these questions using I/you/he/she/we/they and . . . o'clock, a quarter to . . ., past . . ., half past . . .",
        titleZh: "模仿例句回答问题。",
        examplePrompt: "When must you come home? (1.00)",
        exampleAnswer: "I must come home at one o'clock."
      }
    ],
    items: [
      {
        id: "lesson-66-A1",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "I am going to see him _____ ten o'clock.",
        answer: "at"
      },
      {
        id: "lesson-66-A2",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "It often rains _____ November.",
        answer: "in"
      },
      {
        id: "lesson-66-A3",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "Where do you come _____? I come _____ France.",
        answer: "from, from"
      },
      {
        id: "lesson-66-A4",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "I always go to work _____ the morning.",
        answer: "in"
      },
      {
        id: "lesson-66-A5",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "What's the climate like _____ your country?",
        answer: "in"
      },
      {
        id: "lesson-66-A6",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "fill",
        section: "A",
        speakerZh: "",
        speakerEn: "A",
        prompt: "It's cold _____ winter and hot _____ summer.",
        answer: "in, in"
      },
      {
        id: "lesson-66-B1",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must she go to the library? (1.15)",
        answer: "She must go to the library at a quarter past one."
      },
      {
        id: "lesson-66-B2",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must you and Sam see the dentist? (3.45)",
        answer: "You and Sam must see the dentist at a quarter to four."
      },
      {
        id: "lesson-66-B3",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must you type this letter? (2.00)",
        answer: "I must type this letter at two o'clock."
      },
      {
        id: "lesson-66-B4",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must Sam and Penny see the boss? (1.30)",
        answer: "Sam and Penny must see the boss at half past one."
      },
      {
        id: "lesson-66-B5",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must George take his medicine? (3.15)",
        answer: "George must take his medicine at a quarter past three."
      },
      {
        id: "lesson-66-B6",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must Sophie arrive in London? (2.30)",
        answer: "Sophie must arrive in London at half past two."
      },
      {
        id: "lesson-66-B7",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must I catch the bus? (3.30)",
        answer: "You must catch the bus at half past three."
      },
      {
        id: "lesson-66-B8",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must you arrive there? (3.00)",
        answer: "I must arrive there at three o'clock."
      },
      {
        id: "lesson-66-B9",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must they come home? (2.15)",
        answer: "They must come home at a quarter past two."
      },
      {
        id: "lesson-66-B10",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must you meet Sam? (1.45)",
        answer: "I must meet Sam at a quarter to two."
      },
      {
        id: "lesson-66-B11",
        lesson: 66,
        lessonTitle: "What's the time?",
        kind: "sentence",
        mode: "sentence",
        section: "B",
        speakerZh: "",
        speakerEn: "B",
        prompt: "When must he telephone you? (2.45)",
        answer: "He must telephone me at a quarter to three."
      }
    ]
  }
];
