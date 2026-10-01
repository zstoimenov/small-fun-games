/* Screen check - opens pages at phone, tablet and desktop sizes, in light and  */
/* dark, and flags what tends to go wrong on a size nobody looked at.          */
/*                                                                             */
/* Run with the site served on :8080 (python3 -m http.server 8080):            */
/*   NODE_PATH=$(npm root -g) node tools/screen-check.js [page ...] [--out dir] */
/* Pages are folders ("little-city") or "" for the launcher; no pages means    */
/* the launcher and every game in games.js. Screenshots and one contact sheet  */
/* per page go to --out (default: a screen-check folder in the temp dir).      */
/*                                                                             */
/* Flags:  wide   the page scrolls sideways                                   */
/*         taps   buttons or links smaller than 40px across                   */
/*         text   text smaller than 13px                                      */
/* Only the first screen is checked, after closing any how-to-play intro.      */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) {
  console.error("Needs Playwright: NODE_PATH=$(npm root -g) node tools/screen-check.js");
  process.exit(1);
}

const SIZES = [
  ["phone", 375, 667, true],
  ["phone-sideways", 740, 360, true],
  ["tablet", 820, 1180, true],
  ["tablet-sideways", 1180, 820, true],
  ["laptop", 1366, 768, false],
  ["desktop", 1920, 1080, false]
];
const BASE = "http://localhost:8080/";

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : path.join(os.tmpdir(), "screen-check");
let pages = args;
if (!pages.length) {
  const src = fs.readFileSync(path.join(__dirname, "..", "games.js"), "utf8");
  pages = ["", ...[...src.matchAll(/folder:\s*"([^"]+)"/g)].map((m) => m[1])];
}
fs.mkdirSync(out, { recursive: true });

// Runs in the page: what a kid would actually see and tap.
function measure() {
  const seen = (e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : e.classList[0] ? "." + e.classList[0] : "") + ' "' + (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 14) + '"';
  const taps = [...document.querySelectorAll("button, a[href], [role=button], input:not([type=hidden]), select")].filter(seen)
    // A range slider's thumb is what gets dragged, not the thin track.
    .filter((e) => e.type !== "range")
    .filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; });
  const text = [...document.querySelectorAll("body *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && seen(e))
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13);
  return { wide: document.documentElement.scrollWidth - innerWidth, taps: taps.map(name), text: text.map(name) };
}

(async () => {
  const browser = await chromium.launch();
  let problems = 0;
  for (const pg of pages) {
    const label = pg || "launcher", shots = [];
    for (const theme of ["light", "dark"]) {
      for (const [size, w, h, touch] of SIZES) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 800, colorScheme: theme });
        const page = await ctx.newPage();
        await page.goto(BASE + (pg ? pg + "/" : ""), { waitUntil: "load" });
        await page.waitForTimeout(300);
        for (let i = 0; i < 4; i++) {
          const b = page.locator("button:visible").filter({ hasText: /Got it|^\s*Skip|Let.s go/ }).first();
          if (!(await b.count())) break;
          await b.click({ timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(250);
        }
        const m = await page.evaluate(measure);
        const file = `${label}-${theme}-${size}.png`;
        await page.screenshot({ path: path.join(out, file) });
        shots.push({ file, size, theme, w, h });
        const notes = [];
        if (m.wide > 0) notes.push(`wide +${m.wide}px`);
        if (m.taps.length) notes.push(`taps ${m.taps.length}: ${m.taps.slice(0, 3).join(", ")}`);
        if (m.text.length) notes.push(`text ${m.text.length}: ${m.text.slice(0, 3).join(", ")}`);
        // Size problems don't change with the theme, so report them once.
        if (notes.length && theme === "light") { problems++; console.log(`${label.padEnd(20)} ${size.padEnd(16)} ${notes.join(" | ")}`); }
        await ctx.close();
      }
    }
    // One sheet per page: every size side by side, light above dark.
    const cell = (s) => `<figure><img src="${s.file}" style="height:300px;width:${Math.round((300 * s.w) / s.h)}px"><figcaption>${s.theme} · ${s.size}</figcaption></figure>`;
    const html = `<!doctype html><body style="margin:8px;background:#777;font:12px sans-serif;color:#fff">
      <style>figure{margin:4px;display:inline-block;vertical-align:top}img{display:block;border:1px solid #333}</style>
      ${shots.map(cell).join("")}</body>`;
    fs.writeFileSync(path.join(out, `${label}.html`), html);
    const sheet = await browser.newPage({ viewport: { width: 1900, height: 400 } });
    await sheet.goto("file://" + path.join(out, `${label}.html`));
    await sheet.screenshot({ path: path.join(out, `${label}-sheet.png`), fullPage: true });
    await sheet.close();
  }
  await browser.close();
  console.log(`\n${problems ? problems + " page sizes with something to look at" : "Nothing flagged"}. Screenshots: ${out}`);
})();
