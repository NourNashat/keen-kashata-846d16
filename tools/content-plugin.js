import fs from "node:fs";
import path from "node:path";
import { parseLesson, ContentError } from "./lesson-md.js";
import { Books } from "./schema.js";

const VIRTUAL = "virtual:content-manifest";
const RESOLVED = "\0" + VIRTUAL;
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/** يقرأ content/ كله ويتحقق منه. يرمي ContentError بكل المشاكل مجمّعة. */
export function loadContent(root) {
  const dir = path.join(root, "content");
  const errors = [], files = [path.join(dir, "books.json")];
  let books = [];
  try {
    books = Books.parse(JSON.parse(fs.readFileSync(files[0], "utf8")));
  } catch (e) {
    throw new ContentError(`content/books.json: ${e.issues ? e.issues.map((i) => i.message).join("; ") : e.message}`);
  }
  const seen = new Map(), out = [];
  const known = new Set(books.map((b) => b.id));
  for (const d of fs.readdirSync(dir, { withFileTypes: true }))
    if (d.isDirectory() && !known.has(d.name)) errors.push(`content/${d.name}/ — مجلد مالوش باب في books.json`);

  for (const b of books) {
    const lessons = [];
    const bdir = path.join(dir, b.id);
    const names = fs.existsSync(bdir) ? fs.readdirSync(bdir).filter((f) => f.endsWith(".md")).sort(natural) : [];
    for (const name of names) {
      const abs = path.join(bdir, name), rel = `content/${b.id}/${name}`;
      files.push(abs);
      try {
        const l = parseLesson(fs.readFileSync(abs, "utf8"), rel);
        if (name !== `${l.id}.md`) throw new ContentError(`${rel}:1 — اسم الملف لازم يكون ${l.id}.md`);
        if (seen.has(l.id)) throw new ContentError(`${rel}:1 — id "${l.id}" مكرر (موجود في ${seen.get(l.id)})`);
        seen.set(l.id, rel);
        const meta = l.secs.map((s) => ({ p: s.p, e: s.e.length, m: s.m.length }));
        lessons.push({
          id: l.id, no: l.no, title: l.title, file: "/" + rel,
          counts: { e: meta.reduce((n, s) => n + s.e, 0), m: meta.reduce((n, s) => n + s.m, 0) },
          meta, _data: { secs: l.secs, review: l.review ?? null },
        });
      } catch (e) {
        if (e instanceof ContentError) errors.push(e.message); else throw e;
      }
    }
    out.push({ ...b, lessons });
  }
  if (errors.length) throw new ContentError(errors.join("\n"));
  return { books: out, files, dir };
}

export default function contentPlugin() {
  let root = process.cwd();
  return {
    name: "cq-content",
    enforce: "pre",
    configResolved(c) { root = c.root; },
    resolveId(id) { if (id === VIRTUAL) return RESOLVED; },
    load(id) {
      if (id !== RESOLVED) return;
      const { books, files } = loadContent(root);
      files.forEach((f) => this.addWatchFile(f));
      // المانيفست خفيف: عناوين + عدّادات فقط، من غير نص الأسئلة
      const light = books.map((b) => ({ ...b, lessons: b.lessons.map(({ _data, ...l }) => l) }));
      return `export default ${JSON.stringify({ books: light })}`;
    },
    transform(code, id) {
      const clean = id.split("?")[0];
      if (!clean.endsWith(".md") || !clean.includes("/content/")) return;
      const l = parseLesson(code, path.relative(root, clean));
      return { code: `export default ${JSON.stringify({ secs: l.secs, review: l.review ?? null })}`, map: null };
    },
    handleHotUpdate({ file, server }) {
      if (!file.includes(`${path.sep}content${path.sep}`)) return;
      const m = server.moduleGraph.getModuleById(RESOLVED);
      if (m) server.moduleGraph.invalidateModule(m);
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
