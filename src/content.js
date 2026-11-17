// تحميل كسول: كل ملف درس بيتحوّل لـ chunk مستقل، ومش بيتنزّل غير لما الدرس يتفتح.
const loaders = import.meta.glob("/content/*/*.md");
const cache = new Map();

export function loadLesson(l) {
  const load = loaders[l.file];
  if (!load) return Promise.reject(new Error("lesson file missing: " + l.file));
  if (!cache.has(l.id))
    cache.set(l.id, load().then((m) => m.default).catch((e) => { cache.delete(l.id); throw e; }));
  return cache.get(l.id);
}
