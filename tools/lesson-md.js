/*
 * صيغة ملف الدرس (Markdown):
 *
 * ---
 * id: l1
 * no: الدرس الأول
 * title: عنوان الدرس
 * ---
 *
 * ## [1] المهام الأدائية          ← [رقم الفترة 1..3] ثم عنوان القسم
 *
 * ### سؤال: نص السؤال المقالي     ← الإجابة = كل الأسطر حتى العنوان التالي
 * إجابة بصيغة markdown-lite (قوائم، **غامق**، جداول |، = للمعادلات)
 *
 * ### اختيار: نص السؤال الموضوعي
 * - [ ] خيار
 * - [x] الخيار الصحيح (واحد بالظبط)
 * > التفسير (اختياري)
 *
 * ## [review]                      ← جدول مراجعة اختياري في آخر الدرس
 */
import { Lesson } from "./schema.js";

const ESSAY = "### سؤال:";
const MCQ = "### اختيار:";

export class ContentError extends Error {}

export function parseLesson(src, file = "") {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const fail = (n, msg) => {
    throw new ContentError(`${file}:${n} — ${msg}`);
  };
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() !== "---") fail(i + 1, "الملف لازم يبدأ بـ front matter (---)");
  const head = {};
  for (i++; i < lines.length && lines[i].trim() !== "---"; i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/);
    if (!m) fail(i + 1, "سطر front matter لازم يكون key: value");
    head[m[1]] = m[2].trim();
  }
  if (i >= lines.length) fail(i + 1, "front matter ما اتقفلش بـ ---");
  i++;

  const lesson = { ...head, secs: [] };
  const loc = { "": 1 };
  let sec = null, item = null, review = null;
  const closeItem = () => {
    if (!item) return;
    if (item.kind === "e") {
      item.obj.a = trimBlank(item.buf).join("\n");
    } else {
      const xs = item.obj._x;
      delete item.obj._x;
      if (xs.length !== 1) fail(item.line, `لازم علامة [x] واحدة بالظبط (لقيت ${xs.length})`);
      item.obj.c = xs[0];
      item.obj.w = item.why.join("\n");
    }
    item = null;
  };

  for (; i < lines.length; i++) {
    const L = lines[i], n = i + 1;
    if (L.startsWith("## ")) {
      closeItem();
      if (review) review.text = trimBlank(review.buf).join("\n");
      const r = L.match(/^## \[review\]\s*$/);
      const s = L.match(/^## \[(\d+)\]\s+(.+)$/);
      if (r) { review = { buf: [] }; sec = null; lesson.review = ""; loc.review = n; continue; }
      if (!s) fail(n, "عنوان القسم لازم يكون: ## [رقم الفترة] العنوان");
      review = null;
      sec = { p: +s[1], t: s[2].trim(), e: [], m: [] };
      loc[`secs.${lesson.secs.length}`] = n;
      lesson.secs.push(sec);
      continue;
    }
    if (review) { review.buf.push(L); lesson.review = review.buf.join("\n"); continue; }
    if (L.startsWith("### ")) {
      closeItem();
      if (!sec) fail(n, "سؤال خارج أي قسم (## [فترة] ...)");
      if (L.startsWith(ESSAY)) {
        const obj = { q: L.slice(ESSAY.length).trim(), a: "" };
        loc[`secs.${lesson.secs.length - 1}.e.${sec.e.length}`] = n;
        sec.e.push(obj); item = { kind: "e", obj, buf: [], line: n };
      } else if (L.startsWith(MCQ)) {
        const obj = { q: L.slice(MCQ.length).trim(), o: [], _x: [] };
        loc[`secs.${lesson.secs.length - 1}.m.${sec.m.length}`] = n;
        sec.m.push(obj); item = { kind: "m", obj, why: [], line: n };
      } else fail(n, `عنوان سؤال غير معروف — استخدم "${ESSAY}" أو "${MCQ}"`);
      continue;
    }
    if (!item) { if (L.trim()) fail(n, "نص خارج أي سؤال"); continue; }
    if (item.kind === "e") { item.buf.push(L); continue; }
    if (!L.trim()) continue;
    const o = L.match(/^- \[( |x)\] (.*)$/);
    if (o) {
      if (item.why.length) fail(n, "الخيارات لازم تيجي قبل التفسير (>)");
      if (o[1] === "x") item.obj._x.push(item.obj.o.length);
      item.obj.o.push(o[2]);
    } else if (L.startsWith(">")) item.why.push(L.replace(/^>\s?/, ""));
    else fail(n, "سطر غير مفهوم في سؤال اختيار — المتوقع: - [ ] خيار | - [x] صحيح | > تفسير");
  }
  closeItem();
  if (review) lesson.review = trimBlank(review.buf).join("\n");

  const res = Lesson.safeParse(lesson);
  if (!res.success) {
    const msgs = res.error.issues.map((is) => {
      const path = is.path.join(".");
      const key = Object.keys(loc).filter((k) => k && (path === k || path.startsWith(k + "."))).sort((a, b) => b.length - a.length)[0];
      return `${file}:${loc[key] ?? 1} — ${path || "(الملف)"}: ${is.message}`;
    });
    throw new ContentError(msgs.join("\n"));
  }
  return res.data;
}

const trimBlank = (a) => {
  let s = 0, e = a.length;
  while (s < e && !a[s].trim()) s++;
  while (e > s && !a[e - 1].trim()) e--;
  return a.slice(s, e);
};

/* يستخدمه سكربت الترحيل فقط: كائن الدرس → Markdown */
export function stringifyLesson(l) {
  const bad = (s, what) => {
    if (/\n/.test(s)) throw new ContentError(`${what} فيه سطر جديد: ${s.slice(0, 40)}`);
  };
  const chk = (t, what) => {
    if (t.split("\n").some((x) => /^#{2,3} /.test(x))) throw new ContentError(`${what} فيه سطر يبدأ بـ ## أو ###`);
  };
  const out = ["---", `id: ${l.id}`, `no: ${l.no}`, `title: ${l.title}`, "---", ""];
  for (const s of l.secs) {
    out.push(`## [${s.p}] ${s.t}`, "");
    for (const e of s.e) {
      bad(e.q, "سؤال مقالي"); chk(e.a, "إجابة");
      out.push(`${ESSAY} ${e.q}`, e.a, "");
    }
    for (const m of s.m) {
      bad(m.q, "سؤال اختيار");
      out.push(`${MCQ} ${m.q}`);
      m.o.forEach((t, i) => { bad(t, "خيار"); out.push(`- [${i === m.c ? "x" : " "}] ${t}`); });
      if (m.w) m.w.split("\n").forEach((x) => out.push(`> ${x}`));
      out.push("");
    }
  }
  if (l.review) out.push("## [review]", l.review, "");
  return out.join("\n");
}
