/* Math mode: before a score goes on the card, the player works it out.
   Four answers, one try. A miss shows the right answer and how it adds up, and
   the real score is written in either way: the quiz teaches, it never costs
   points. */
"use strict";

window.YZ = window.YZ || {};

YZ.Quiz = (function () {
  const Rules = YZ.Rules;
  const Rng = YZ.Rng;
  const $ = (id) => document.getElementById(id);

  // Only boxes where there is adding to do. Fixed scores (a straight is always
  // 40) and zeros have nothing to work out, so asking would just slow the game.
  function wanted(cat, points) {
    return points > 0 && !cat.points;
  }

  // Which dice make up the score, so the dice that don't count can be dimmed
  // and the working shown as a sum. Worked out from the score itself, which
  // keeps it right for both rule sets without a table per box.
  function counted(cat, dice, points) {
    if (cat.face) return dice.filter((d) => d === cat.face);
    if (points === Rules.sum(dice)) return dice.slice();
    const c = Rules.counts(dice);
    if (cat.id === "twoPairs") {
      const pairs = [];
      for (let f = 6; f >= 1 && pairs.length < 2; f--) if (c[f] >= 2) pairs.push(f);
      return [pairs[0], pairs[0], pairs[1], pairs[1]];
    }
    for (const n of [4, 3, 2]) {
      const f = points / n;
      if (Number.isInteger(f) && c[f] >= n) return Array(n).fill(f);
    }
    return dice.slice();
  }

  function working(parts, points) {
    return parts.length === 1
      ? "Only one " + parts[0] + " counts, so it's " + points + "."
      : parts.join(" + ") + " = " + points;
  }

  // Wrong answers a kid could really land on: adding every die instead of just
  // the ones that count, one die too many or too few, and slips of one or two.
  // Drawn at random so the right answer isn't always the middle one.
  function choices(dice, parts, points) {
    const one = parts[0];
    const pool = [Rules.sum(dice), points + one, points - one,
                  points + 1, points - 1, points + 2, points - 2, points + 10]
      .filter((v, i, a) => v > 0 && v !== points && a.indexOf(v) === i);
    const wrong = Rng.shuffle(pool).slice(0, 3);
    return Rng.shuffle(wrong.concat([points]));
  }

  let done = null;

  // onAnswer(right) runs when the player taps "Write it in"; onBack when they
  // would rather choose another box (only possible before answering).
  function ask(opts) {
    const parts = counted(opts.cat, opts.dice, opts.points);
    done = opts;

    $("quizAsk").innerHTML = "How many points do these dice score in <b>" + opts.cat.label + "</b>?";

    // Dim the dice that don't count, so the question is the adding, not the rules.
    const dice = $("quizDice");
    dice.innerHTML = "";
    const left = parts.slice();
    const strip = YZ.Ui.diceStrip(opts.dice, "mini");
    Array.from(strip.children).forEach((d, i) => {
      const k = left.indexOf(opts.dice[i]);
      if (k >= 0) left.splice(k, 1);
      else d.classList.add("dim");
    });
    dice.appendChild(strip);

    const box = $("quizChoices");
    box.innerHTML = "";
    for (const v of choices(opts.dice, parts, opts.points)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-choice";
      b.textContent = v;
      b.addEventListener("click", () => answer(b, v, parts));
      box.appendChild(b);
    }

    $("quizResult").hidden = true;
    $("quizOk").hidden = true;
    $("quizBack").hidden = false;
    $("quiz").hidden = false;
  }

  function answer(btn, v, parts) {
    if (!done || done.answered !== undefined) return;
    const right = v === done.points;
    done.answered = right;
    for (const b of $("quizChoices").children) {
      b.disabled = true;
      if (+b.textContent === done.points) b.classList.add("right");
    }
    if (!right) btn.classList.add("wrong");

    const out = $("quizResult");
    out.className = "note quiz-result " + (right ? "good" : "bad");
    out.innerHTML = (right ? "✅ Yes! " : "Not quite: ") + working(parts, done.points);
    out.hidden = false;
    if (right) YZ.Audio.bonus(); else YZ.Audio.zero();

    $("quizBack").hidden = true;
    $("quizOk").hidden = false;
    $("quizOk").focus();
  }

  function finish() {
    if (!done || done.answered === undefined) return;
    const d = done;
    done = null;
    $("quiz").hidden = true;
    d.onAnswer(d.answered);
  }

  function back() {
    if (!done || done.answered !== undefined) return;
    const d = done;
    done = null;
    $("quiz").hidden = true;
    if (d.onBack) d.onBack();
  }

  function init() {
    $("quizOk").addEventListener("click", finish);
    $("quizBack").addEventListener("click", back);
  }

  return { wanted, counted, choices, ask, init };
})();
