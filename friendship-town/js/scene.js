/* Friendship Town - the talking lessons: a scene (two moments, three choices  */
/* each) and the Yes Ladder. Each kind takes (lesson, done) and returns a stop */
/* function; done(stars, text) ends the lesson.                               */
"use strict";
window.FT = window.FT || {};
FT.Games = FT.Games || {};

(function () {
  const { h, esc, shuffle, P, stage } = FT.UI;
  const LABEL = { 2: ["great", "⭐ Great choice!"], 1: ["ok", "🤔 That's OK, but..."], 0: ["oops", "😬 Oops!"] };
  const SOUND = { great: "great", ok: "ok", oops: "oops" };

  // ── A scene: two moments, one story ────────────────────────────────────────
  // Hearts are the sum of the choices (best 2, OK 1, poor 0), so four hearts
  // is a perfect lesson. Stars come from the first pick in each moment only:
  // seeing the better choice afterwards is the teaching, not a retry.
  FT.Games.scene = function (lesson, done) {
    let round = 0, sum = 0;
    const MAX = lesson.rounds.length * 2;

    function draw() {
      const r = lesson.rounds[round];
      const b = P.board();
      b.classList.add("scene");
      const st = stage(lesson.where, lesson.who);
      b.appendChild(st.el);
      st.say(r.say, "think");
      const list = h("div", "choices");
      shuffle(r.choices).forEach((c) => {
        const btn = h("button", "choice", "<span>" + esc(c.text) + "</span>");
        btn.type = "button";
        btn.addEventListener("click", () => pick(c, btn, list, st, r));
        c._btn = btn;
        list.appendChild(btn);
      });
      b.appendChild(list);
      P.hearts(sum, MAX);
      P.talk("<b>Moment " + (round + 1) + " of " + lesson.rounds.length + ".</b> Tap what you would say or do.");
      P.acts([]);
    }

    function pick(c, btn, list, st, r) {
      [...list.children].forEach((x) => { x.disabled = true; });
      const [kind, head] = LABEL[c.good];
      btn.classList.add("picked", kind);
      sum += c.good;
      st.say(c.reply, kind);
      FT.Audio[SOUND[kind]]();
      let html = "<b>" + head + "</b> " + esc(c.why);
      if (c.good < 2) {
        const best = r.choices.find((x) => x.good === 2);
        best._btn.classList.add("best");
        html += '<span class="better">⭐ Better: ' + esc(best.text) + "</span>";
      }
      P.talk(html, kind);
      P.hearts(sum, MAX);
      const last = round === lesson.rounds.length - 1;
      P.acts([{ label: last ? "Finish ›" : "Next ›", go: () => {
        if (last) done(sum === MAX ? 3 : sum >= MAX - 1 ? 2 : 1, "Friendship hearts: " + sum + " of " + MAX + ".");
        else { round++; draw(); }
      } }]);
    }

    draw();
    return () => {};
  };

  // ── The Yes Ladder: climb by asking things they'll agree with ─────────────
  FT.Games.ladder = function (lesson, done) {
    let rung = 0, misses = 0;
    const N = lesson.rungs.length;
    const b = P.board();
    b.classList.add("ladder-board");
    const top = h("div", "ladder-top");
    const st = stage(lesson.where, lesson.who);
    top.appendChild(st.el);
    const lad = h("div", "ladder", "");
    lad.setAttribute("aria-hidden", "true");
    for (let i = N; i >= 0; i--) lad.appendChild(h("div", "rung", i === N ? "🏆" : ""));
    top.appendChild(lad);
    b.appendChild(top);
    const list = h("div", "choices two");
    b.appendChild(list);
    st.say("Hi! What's up?", "think");

    function climber() {
      [...lad.children].forEach((e, i) => {
        const at = N - i;
        e.classList.toggle("done", at < rung);
        e.textContent = at === rung ? "🧗" : at === N ? "🏆" : at < rung ? "✅" : "";
      });
    }
    function draw() {
      const r = lesson.rungs[rung];
      list.innerHTML = "";
      shuffle([["yes", r.yes], ["no", r.no]]).forEach(([k, text]) => {
        const btn = h("button", "choice", "<span>" + esc(text) + "</span>");
        btn.type = "button";
        btn.addEventListener("click", () => pick(k, btn));
        list.appendChild(btn);
      });
      climber();
      P.hearts(rung, N);
      P.talk("<b>Step " + (rung + 1) + " of " + N + ".</b> Pick the question that gets a happy “yes”.");
      P.acts([]);
    }
    function pick(k, btn) {
      const r = lesson.rungs[rung];
      if (k === "no") {
        misses++;
        btn.disabled = true;
        btn.classList.add("picked", "oops");
        st.say(r.noReply, "oops");
        FT.Audio.oops();
        P.talk("<b>😬 That got a “no”.</b> Once someone says no, they dig in. Start with something you both agree on.", "oops");
        return;
      }
      [...list.children].forEach((x) => { x.disabled = true; });
      btn.classList.add("picked", "great");
      st.say(r.yesReply, "great");
      FT.Audio.great();
      rung++;
      climber();
      P.hearts(rung, N);
      if (rung === N) {
        P.talk("<b>⭐ They said yes!</b> Each little “yes” made the big “yes” easier.", "great");
        P.acts([{ label: "Finish ›", go: () => done(misses === 0 ? 3 : misses <= 2 ? 2 : 1, misses === 0 ? "Yes all the way up!" : "You got a “no” " + misses + (misses === 1 ? " time." : " times.")) }]);
      } else {
        P.talk("<b>⭐ A “yes”!</b> Up you go. Keep finding things you agree on.", "great");
        P.acts([{ label: "Next step ›", go: draw }]);
      }
    }
    draw();
    return () => {};
  };
})();
