/* Yatzy Dice — how to play.                                                    */
/*                                                                              */
/* Opens by itself the first time someone plays, and lives behind the ? button   */
/* after that. Every number in here — bonus thresholds, what a straight is worth,*/
/* how many boxes there are — is read out of rules.js rather than written into   */
/* the text, so the lesson matches whichever rule set is actually being played.  */
/* The dice in the pictures are real die elements from ui.js, so what you learn  */
/* on looks exactly like what you play on.                                       */
"use strict";
window.YZ = window.YZ || {};

YZ.Tutorial = (function () {
  const Rules = YZ.Rules;
  const Ui = YZ.Ui;
  const $ = (id) => document.getElementById(id);

  let cards = [];
  let at = 0;
  let onPractice = null;
  let onClose = null;

  /* ── Little builders ───────────────────────────────────────────────────── */

  function node(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function card(icon, title, build) {
    return { icon: icon, title: title, build: build };
  }

  // A row of dice with a caption underneath — the workhorse of the lesson.
  function example(dice, caption, held) {
    const wrap = node("div", "howto-example");
    const strip = node("div", "dice-strip");
    dice.forEach((v, i) => {
      const d = Ui.dieEl(v, "mini");
      if (held && held[i]) d.classList.add("held");
      strip.appendChild(d);
    });
    wrap.appendChild(strip);
    if (caption) wrap.appendChild(node("p", "howto-caption", caption));
    return wrap;
  }

  /* ── The cards ─────────────────────────────────────────────────────────── */

  function build(ruleset) {
    const boxes = ruleset.categories.length;
    const upper = ruleset.upperBonus;
    const top = ruleset.categories.find((c) => c.big);

    return [
      card("🎲", "The idea", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "You have <b>" + boxes + " boxes</b> to fill in. Every turn you roll five dice and " +
          "put your score in <b>one</b> box. When every box is full, the biggest total wins."));
        f.appendChild(node("p", "howto-note",
          "You're playing <b>" + ruleset.name + "</b>. " + ruleset.blurb));
        return f;
      }),

      card("🎯", "Three rolls a turn", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "Tap <b>ROLL THE DICE</b> to throw all five. You get up to <b>three rolls</b> each turn — " +
          "so you can throw away the ones you don't like and try again."));
        f.appendChild(example([2, 5, 5, 1, 3], "First roll: a pair of 5s, and three duds."));
        return f;
      }),

      card("✋", "Keeping dice", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "Tap a die to <b>keep</b> it. Kept dice light up and stay put; everything else gets " +
          "thrown again. Tap a kept die again if you change your mind."));
        f.appendChild(example([2, 5, 5, 1, 3], "Keep the two 5s…", [false, true, true, false, false]));
        f.appendChild(example([5, 5, 5, 6, 1], "…roll the other three, and now there are three.",
          [true, true, true, false, false]));
        return f;
      }),

      card("📋", "Filling a box", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "After your rolls, the scorecard shows what your dice are worth in every box that's " +
          "still empty. Tap the one you want. The box <b>we'd</b> choose is " +
          "<span class='howto-ring'>ringed</span> — that isn't always the biggest number, " +
          "because it's worth saving a good box for a hand that deserves it."));
        f.appendChild(node("p", null,
          "You must fill a box every turn — even if the only thing left scores <b>zero</b>. " +
          "That's part of the game, and part of the fun."));
        return f;
      }),

      card("⬆️", "The top half and its bonus", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "The top six boxes only count one number each. Put your 4s in <b>Fours</b>, your 6s in " +
          "<b>Sixes</b>, and so on — nothing else in the hand counts."));
        f.appendChild(example([4, 4, 4, 2, 6], "In Fours this is 12. In Sixes it's 6. In Twos, 2."));
        f.appendChild(node("p", "howto-note",
          "Get your top half to <b>" + upper.threshold + "</b> and you win a <b>" + upper.points +
          " point bonus</b>. The trick: three of each number gets you there exactly."));
        return f;
      }),

      card("⭐", "The bottom half", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null, "These are the special ones. Tap any box name during a game to see this again."));
        const list = node("div", "howto-list");
        for (const c of ruleset.categories.filter((x) => x.section === "lower")) {
          const row = node("div", "howto-list-row");
          const left = node("div", "hl-left");
          left.appendChild(node("strong", null, c.label));
          left.appendChild(node("span", "hl-hint", c.hint));
          row.appendChild(left);
          const right = node("div", "hl-right");
          right.appendChild(Ui.diceStrip(c.example, "tiny"));
          right.appendChild(node("span", "hl-score", c.score(c.example) + ""));
          row.appendChild(right);
          list.appendChild(row);
        }
        f.appendChild(list);
        if (top) {
          f.appendChild(node("p", "howto-note",
            "All five the same is a <b>" + top.label + "</b> — " + top.points + " points, and the " +
            "loudest cheer in the game."));
        }
        return f;
      }),

      card("👥", "Playing together", () => {
        const f = document.createDocumentFragment();
        f.appendChild(node("p", null,
          "<b>1, 2 or 3 players.</b> Everyone shares the one device and takes turns — the " +
          "scorecard highlights whose go it is."));
        f.appendChild(node("p", null,
          "<b>On your own?</b> The computer plays against you. Pick Easy, Medium or Hard when you start."));
        f.appendChild(node("p", null,
          "<b>Got real dice?</b> Choose <b>Scorecard only</b> and the app just keeps score — " +
          "roll your own dice, tap in what you got, and it works out every box for you."));
        f.appendChild(node("p", "howto-note",
          "The dice in this app come from your device's proper random number generator, so they're " +
          "as fair as the ones on your table. There's a <b>Dice check</b> in the menu if you'd like to see the proof."));
        return f;
      })
    ];
  }

  /* ── Paging ────────────────────────────────────────────────────────────── */

  function render() {
    const c = cards[at];
    const body = $("howtoBody");
    body.innerHTML = "";
    body.scrollTop = 0;
    body.appendChild(node("div", "howto-icon", c.icon));
    body.appendChild(node("h2", "howto-title", c.title));
    body.appendChild(c.build());

    $("howtoStep").textContent = at + 1 + " / " + cards.length;
    $("howtoPrev").disabled = at === 0;
    const last = at === cards.length - 1;
    $("howtoNext").textContent = last ? (onPractice ? "Try a turn 🎲" : "Let's play ▶") : "Next ›";

    const dots = $("howtoDots");
    dots.innerHTML = "";
    cards.forEach((_, i) => {
      const d = node("i", "dot" + (i === at ? " on" : ""));
      d.addEventListener("click", () => { at = i; render(); });
      dots.appendChild(d);
    });
  }

  function next() {
    if (at < cards.length - 1) {
      at++;
      render();
      YZ.Audio.tap();
      return;
    }
    close();
    if (onPractice) onPractice();
  }

  function prev() {
    if (at > 0) { at--; render(); YZ.Audio.tap(); }
  }

  function close() {
    $("howto").hidden = true;
    if (onClose) onClose();
  }

  /* ── Entry point ───────────────────────────────────────────────────────── */

  // opts: { practice: fn|null, onClose: fn|null }
  function open(rulesetId, opts) {
    opts = opts || {};
    cards = build(Rules.get(rulesetId));
    at = 0;
    onPractice = opts.practice || null;
    onClose = opts.onClose || null;
    $("howto").hidden = false;
    render();
  }

  function init() {
    $("howtoNext").addEventListener("click", next);
    $("howtoPrev").addEventListener("click", prev);
    $("howtoSkip").addEventListener("click", () => { onPractice = null; close(); });
  }

  return { init, open, close };
})();
