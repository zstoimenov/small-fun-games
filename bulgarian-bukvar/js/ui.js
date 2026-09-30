/* Буквар Quest - everything that touches the page.                             */
/*                                                                              */
/* ui.js draws and reports; it never decides anything. The app says what to     */
/* show and hands over callbacks. What counts as right is rules.js's business.  */
"use strict";
window.BQ = window.BQ || {};

BQ.UI = (function () {
  const L = BQ.Letters;
  const R = BQ.Rules;
  const $ = (id) => document.getElementById(id);
  let toastTimer = 0;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const bg = (s) => '<span lang="bg">' + esc(s) + "</span>";
  const emo = (e) => '<span class="emoji" aria-hidden="true">' + e + "</span>";

  function screen(id, title) {
    ["home", "play"].forEach((s) => { $(s).hidden = s !== id; });
    $("back").hidden = id !== "home";
    $("toHome").hidden = id === "home";
    $("title").textContent = title || "Буквар Quest";
    window.scrollTo(0, 0);
  }

  function steps(list, cur) {
    $("steps").innerHTML = list.map((s, i) =>
      '<span class="step' + (i < cur ? " done" : i === cur ? " now" : "") + '">' + esc(s) + "</span>").join("");
  }

  // Every step says up front whether a grown-up is needed, so a child alone
  // knows to go and fetch one instead of guessing at sounds.
  function who(kind) {
    const el = $("who");
    el.className = "who " + (kind || "");
    el.textContent = kind === "together" ? "👥 Together: a grown-up says the sounds and listens"
      : kind === "solo" ? "🙋 On your own" : "";
  }

  const stage = (html) => { $("stage").innerHTML = html; return $("stage"); };

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ── Home ────────────────────────────────────────────────────────────────
  function map(done, next, onPick) {
    const M = BQ.MISSIONS;
    $("map").innerHTML = M.map((m, i) => {
      const open = i === 0 || done[i - 1] > 0;
      const cls = done[i] > 0 ? "done" : i === next ? "now" : open ? "" : "locked";
      return '<button type="button" data-i="' + i + '" class="' + cls + '"' + (open ? "" : " disabled") +
        ' aria-label="Mission ' + (i + 1) + (open ? "" : ", locked") + '">' +
        "<b>" + (i + 1) + "</b>" +
        '<span class="ls" lang="bg">' + (open ? m.letters.join("") : "🔒") + "</span>" +
        '<span class="st">' + "★".repeat(done[i] || 0) + "</span></button>";
    }).join("");
    $("map").onclick = (e) => { const b = e.target.closest("button[data-i]"); if (b && !b.disabled) onPick(+b.dataset.i); };
  }

  function abc(known, onPick) {
    const have = new Set(known);
    $("abc").innerHTML = L.ALPHABET.map((l) =>
      '<button type="button" data-c="' + l.up + '" class="' + (have.has(l.up) ? "known" : "locked") + '"' +
      (have.has(l.up) ? "" : " disabled") + ">" + l.up + "<small>" + l.lo + "</small></button>").join("");
    $("abc").onclick = (e) => { const b = e.target.closest("button[data-c]"); if (b && !b.disabled) onPick(b.dataset.c); };
  }

  // The letter card: shared by the home alphabet and the Learn step.
  function letterCard(c, example) {
    const l = L.BY[c];
    const pic = example ? BQ.MISSIONS.flatMap((m) => m.words).find((w) => w[0] === example) : null;
    const word = example ? example.split("").map((ch) => (ch.toUpperCase() === c ? "<mark>" + esc(ch) + "</mark>" : esc(ch))).join("") : "";
    return '<div class="ruled">' +
      '<div class="letter-big" lang="bg"><span class="up">' + l.up + '</span><span class="lo">' + l.lo + "</span></div>" +
      '<p class="hint">Sounds like <b>' + esc(l.hint) + "</b></p>" +
      (example ? '<div class="example">' + (pic ? emo(pic[1]) : "") + '<span lang="bg">' + word + "</span></div>" : "") +
      "</div>";
  }

  function showLetter(c, example) {
    $("letterTitle").textContent = "The letter " + c;
    $("letterBody").innerHTML = letterCard(c, example);
    $("letterDialog").showModal();
  }

  // ── Steps ───────────────────────────────────────────────────────────────
  // The grown-up's pair of buttons. `yes` moves on; `again` stays put.
  function grownup(yesLabel, againLabel) {
    return '<div class="grownup"><p>Grown-up, tap one:</p><div class="actions">' +
      '<button class="btn ghost" type="button" data-act="again">↻ ' + esc(againLabel) + "</button>" +
      '<button class="btn" type="button" data-act="yes">✓ ' + esc(yesLabel) + "</button></div></div>";
  }

  function learn(c, example, i, n, last) {
    return stage(
      '<div class="bar"><span class="count">New letter ' + (i + 1) + " of " + n + "</span></div>" +
      '<p class="say">Grown-up: say the sound. Then say it together, three times.</p>' +
      letterCard(c, example) +
      '<div class="actions"><button class="btn" type="button" data-act="next">' +
      (last ? "Start blending ›" : "Next letter ›") + "</button></div>");
  }

  function blend(item, i, n, pic) {
    const chars = item.split("");
    return stage(
      '<div class="bar"><span class="count">' + (i + 1) + " / " + n + "</span></div>" +
      '<p class="say">Tap each letter and say its sound. Then say them all together, fast!</p>' +
      '<button class="blend" type="button" id="blendRow" lang="bg" aria-label="Light the next letter">' +
      chars.map((c, k) => '<span class="' + (k === 0 ? "next" : "") + '">' + esc(c) + "</span>").join("") + "</button>" +
      '<div class="blend-pic" id="blendPic">' + "</div>" +
      '<div id="blendDone" hidden>' + grownup("Read it!", "Try again") + "</div>");
  }

  function lightBlend(k, total, pic) {
    const spans = $("blendRow").querySelectorAll("span");
    spans.forEach((s, j) => { s.classList.toggle("lit", j < k); s.classList.toggle("next", j === k); });
    if (k >= total) {
      $("blendRow").classList.add("whole");
      $("blendPic").innerHTML = pic ? emo(pic) : "";
      $("blendDone").hidden = false;
    }
  }

  function match(r, i, n) {
    const pic2word = r.kind === "pic2word";
    return stage(
      '<div class="bar"><span class="count">' + (i + 1) + " / " + n + '</span><span class="muted">' +
      (pic2word ? "Which word is it?" : "Which picture is it?") + "</span></div>" +
      '<div class="prompt">' + (pic2word ? '<span class="emoji">' + r.answer.e + "</span>" : '<span class="w" lang="bg">' + esc(r.answer.w) + "</span>") + "</div>" +
      '<div class="tiles">' + r.options.map((o, k) =>
        '<button class="tile' + (pic2word ? "" : " pic") + '" type="button" data-k="' + k + '"' + (pic2word ? ' lang="bg">' + esc(o.w) : ">" + emo(o.e)) + "</button>").join("") +
      "</div>");
  }

  function build(b, i, n) {
    return stage(
      '<div class="bar"><span class="count">' + (i + 1) + " / " + n + '</span>' +
      '<button class="small-btn" type="button" data-act="hint">💡 Help me</button></div>' +
      '<p class="say">Spell the word. Tap the letters in order.</p>' +
      '<div class="prompt">' + '<span class="emoji">' + b.answer.e + "</span></div>" +
      '<div class="slots" id="slots" lang="bg">' + b.answer.w.split("").map((c, k) => '<span class="' + (k === 0 ? "next" : "") + '"></span>').join("") + "</div>" +
      '<div class="loose" id="loose" lang="bg">' + b.tiles.map((c, k) => '<button class="tile" type="button" data-k="' + k + '">' + esc(c) + "</button>").join("") + "</div>");
  }

  function fillSlot(k, ch) {
    const s = $("slots").querySelectorAll("span");
    s[k].textContent = ch;
    s[k].classList.add("full");
    s[k].classList.remove("next");
    if (s[k + 1]) s[k + 1].classList.add("next");
  }

  function read(sentence, i, n) {
    const words = sentence.split(" ");
    return stage(
      '<div class="bar"><span class="count">' + (i + 1) + " / " + n + "</span></div>" +
      '<p class="say">Read it out loud to your grown-up. Tap each word as you read it.</p>' +
      '<div class="ruled"><p class="sentence" lang="bg">' + words.map((w) => '<button type="button">' + esc(w) + "</button>").join("") + "</p></div>" +
      grownup("Well read!", "Try again"));
  }

  // Tricky letters: "what does this letter say?" or "which letter says this?"
  function trap(r, i, n) {
    const sound = r.kind === "sound";
    return stage(
      '<div class="bar"><span class="count">' + (i + 1) + " / " + n + '</span><span class="muted">' +
      (sound ? "What sound does it make?" : "Which letter makes this sound?") + "</span></div>" +
      '<div class="prompt">' + (sound ? '<span class="w huge" lang="bg">' + esc(r.show) + "</span>" : '<span class="s">' + esc(r.show) + "</span>") + "</div>" +
      '<div class="tiles' + (sound ? " one" : "") + '">' + r.options.map((o, k) =>
        '<button class="tile' + (sound ? " snd" : "") + '" type="button" data-k="' + k + '"' + (sound ? ">" : ' lang="bg">') + esc(o) + "</button>").join("") +
      "</div>");
  }

  function starsHtml(n) { return "★".repeat(n) + "<i>" + "★".repeat(3 - n) + "</i>"; }

  return { $, esc, bg, emo, screen, steps, who, stage, toast, map, abc, letterCard, showLetter, grownup, learn, blend, lightBlend, match, build, fillSlot, read, trap, starsHtml };
})();
