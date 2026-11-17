import { z } from "zod";

const text = z.string().trim().min(1, "نص فارغ");

export const Essay = z.object({ q: text, a: text }).strict();

export const Mcq = z
  .object({
    q: text,
    o: z.array(text).min(2, "خيارين على الأقل").max(4, "أقصى عدد خيارات 4 (أ ب ج د)"),
    c: z.number().int().min(0),
    w: z.string().default(""),
  })
  .strict()
  .refine((m) => m.c < m.o.length, { message: "رقم الإجابة الصحيحة خارج نطاق الخيارات", path: ["c"] })
  .refine((m) => new Set(m.o).size === m.o.length, { message: "فيه خيارات مكررة", path: ["o"] });

export const Section = z
  .object({
    p: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    t: text,
    e: z.array(Essay),
    m: z.array(Mcq),
  })
  .strict()
  .refine((s) => s.e.length + s.m.length > 0, { message: "القسم ما فيهوش أي سؤال" });

export const Lesson = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9]*$/, "id حروف إنجليزي صغير وأرقام فقط"),
    no: text,
    title: text,
    secs: z.array(Section).min(1, "الدرس لازم يحتوي قسم واحد على الأقل"),
    review: z.string().optional(),
  })
  .strict();

export const Book = z
  .object({
    id: z.string().regex(/^b\d+$/, "id الباب بصيغة b1, b2, ..."),
    no: text,
    title: text,
  })
  .strict();

export const Books = z.array(Book).refine((a) => new Set(a.map((b) => b.id)).size === a.length, "id باب مكرر");
