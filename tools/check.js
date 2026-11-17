// npm run check — يتحقق من كل ملفات content/ ويطبع ملخص
import { loadContent } from "./content-plugin.js";
try {
  const { books } = loadContent(process.cwd());
  let tq = 0;
  for (const b of books) {
    const q = b.lessons.reduce((n, l) => n + l.counts.e + l.counts.m, 0);
    tq += q;
    console.log(`${b.id}  ${b.lessons.length} دروس  ${q} سؤال  — ${b.title}`);
  }
  console.log(`✓ المحتوى سليم: ${books.reduce((n, b) => n + b.lessons.length, 0)} درس، ${tq} سؤال`);
} catch (e) {
  console.error("✗ فيه أخطاء في المحتوى:\n" + e.message);
  process.exit(1);
}
