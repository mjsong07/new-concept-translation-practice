// 说话人性别判定。独立成纯 TS 模块以便 Node 脚本（scripts/generate-audio.mjs）
// 直接复用，勿改动判定规则。

const femaleSpeakers = new Set([
  "AMY", "ANN", "ANNA", "CAROL", "CAROLINE", "CATHERINE", "CHARLOTTE", "CHRISTINE", "HELEN", "JANE",
  "JEAN", "JENNY", "JILL", "JULIE", "KATE", "LINDA", "LIZ", "LOUISE", "LUCY", "MISS MARSH", "NAOKO",
  "PAMELA", "PAULINE", "PENNY", "SANDRA", "SOPHIE", "SUSAN", "XIAOHUI"
]);
const maleSpeakers = new Set([
  "ANDY", "BOB", "BRIAN", "CHANG-WOO", "DAN", "DAVE", "DIMITRI", "GARY", "GEORGE", "GRAHAM TURNER",
  "HANS", "IAN", "JACK", "JIM", "JOHN SMITH", "KEN", "LUMING", "MARTIN", "MIKE", "NIGEL", "PETER",
  "RICHARD", "ROBERT", "SAM", "SCOTT", "STEVEN", "TIM", "TOM"
]);

export function speakerGender(speaker: string): "female" | "male" | "unknown" {
  const normalized = speaker.trim().toUpperCase();
  if (femaleSpeakers.has(normalized) || /\b(MRS|MISS|MOTHER|GRANDMOTHER|WOMAN|LADY|GIRLS?|NURSE)\b/.test(normalized)) return "female";
  if (maleSpeakers.has(normalized) || /\b(MR|FATHER|MAN|BOY|POLICEMAN)\b/.test(normalized)) return "male";
  return "unknown";
}
