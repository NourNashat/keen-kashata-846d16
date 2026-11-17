import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";

const until = async (fn, ms = 3000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (fn()) return; await new Promise((r) => setTimeout(r, 20)); }
  throw new Error("timeout");
};
const go = (h) => { location.hash = h; window.dispatchEvent(new HashChangeEvent("hashchange")); };
const cards = () => document.querySelectorAll("#main .card").length;
let manifest;

beforeAll(async () => {
  const html = fs.readFileSync("index.html", "utf8");
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script type"));
  window.scrollTo = () => {};
  localStorage.setItem("cq-stars", JSON.stringify(["b3l1-0-e0", "l2-0-m0"]));
  manifest = (await import("virtual:content-manifest")).default;
  await import("../src/main.js");
});

describe("lazy loading", () => {
  const all = () => manifest.books.flatMap((b) => b.lessons);
  it("home needs no lesson content", () => {
    expect(document.querySelectorAll(".tile[data-bk]").length).toBe(7);
    expect(all().every((l) => !l.secs)).toBe(true);
  });
  it("opening a lesson loads only that lesson", async () => {
    go("#b2/l1");
    await until(() => cards() > 0);
    const l = all().find((x) => x.id === "l1");
    expect(cards()).toBe(l.counts.e + l.counts.m);
    expect(all().filter((x) => x.secs).map((x) => x.id)).toEqual(["l1"]);
  });
  it("saved view loads only starred lessons", async () => {
    go("#saved");
    await until(() => cards() === 2);
    expect(all().filter((x) => x.secs).map((x) => x.id).sort()).toEqual(["b3l1", "l1", "l2"]);
  });
  it("review table appears on last lesson with review", async () => {
    go("#b2/l3");
    await until(() => cards() > 0);
    expect(document.querySelector("#main .tbl.plain")).toBeTruthy();
  });
  it("search loads everything and finds results", async () => {
    const q = document.querySelector("#q");
    q.value = "TLS"; q.dispatchEvent(new Event("input", { bubbles: true }));
    await until(() => all().every((x) => x.secs) && cards() > 0, 4000);
    expect(cards()).toBeGreaterThan(5);
  });
  it("random exam builds 20 questions", async () => {
    const q = document.querySelector("#q"); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    go("#gx");
    await until(() => document.querySelector("[data-gxn]"));
    document.querySelector('[data-gxn="20"]').click();
    await until(() => cards() === 20);
  });
});
