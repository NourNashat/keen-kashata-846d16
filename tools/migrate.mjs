// تشغيل مرة واحدة: يقرأ الـ JS القديم ويطلع ملفات content/ ثم يتحقق إن النتيجة مطابقة للأصل.
import fs from "node:fs";
import path from "node:path";
import { stringifyLesson, parseLesson } from "./lesson-md.js";

const src = fs.readFileSync(process.argv[2], "utf8").split("\n");
const dataEnd = src.findIndex((l) => l.startsWith("const svg=")); // آخر BOOKS قبل الـ UI
const code = src.slice(0, dataEnd).join("\n") + "\nreturn {BOOKS,REVIEW,REVIEW3};";
const { BOOKS, REVIEW, REVIEW3 } = new Function(code)();
const REVIEWS = { l3: REVIEW, b3l3: REVIEW3 };

fs.rmSync("content", { recursive: true, force: true });
fs.mkdirSync("content", { recursive: true });
fs.writeFileSync("content/books.json", JSON.stringify(BOOKS.map(({ id, no, title }) => ({ id, no, title })), null, 2) + "\n");

let files = 0, qs = 0, bad = [];
for (const b of BOOKS) {
  if (!b.lessons.length) continue;
  fs.mkdirSync(`content/${b.id}`, { recursive: true });
  for (const l of b.lessons) {
    const orig = { id: l.id, no: l.no, title: l.title, secs: l.secs.map((s) => ({ p: s.p, t: s.t, e: s.e, m: s.m.map((m) => ({ ...m, w: m.w ?? "" })) })) };
    if (REVIEWS[l.id]) orig.review = REVIEWS[l.id];
    const file = `content/${b.id}/${l.id}.md`;
    fs.writeFileSync(file, stringifyLesson(orig));
    const back = parseLesson(fs.readFileSync(file, "utf8"), file);
    if (JSON.stringify(back) !== JSON.stringify(orig)) bad.push(file);
    files++; qs += l.secs.reduce((n, s) => n + s.e.length + s.m.length, 0);
  }
}
console.log(`lessons: ${files}, questions: ${qs}, round-trip mismatches: ${bad.length}`, bad);
