/* Friendship Town - the three mini-games: Smile Street, Name Catcher and     */
/* Good Listener. Same shape as scene.js: (lesson, done) -> stop function.    */
"use strict";
window.FT = window.FT || {};
FT.Games = FT.Games || {};

(function () {
  const { h, esc, shuffle, P, stage } = FT.UI;
  const starsFor = (misses) => (misses === 0 ? 3 : misses <= 2 ? 2 : 1);

  // ── Smile Street: neighbours pop out of their doors; tap to smile ─────────
  // Slow at first and a little quicker later, never so fast that a careful
  // eight-year-old can't reach them all. Some look sad: a smile works on them too.
  const FOLK = ["👵", "👴", "👩", "👨", "🧑‍🦱", "👩‍🦳", "🧔", "👧", "🧒", "👱‍♀️", "👨‍🦲", "🧑‍🦰"];
  FT.Games.smile = function (lesson, done) {
    const VISITS = 12, timers = [];
    let shown = 0, smiled = 0, live = 0, over = false;
    const b = P.board();
    b.classList.add("street");
    const grid = h("div", "doors");
    const doors = [];
    for (let i = 0; i < 6; i++) {
      const d = h("button", "door", '<span class="door-face">🚪</span><span class="door-mood"></span>');
      d.type = "button";
      d.setAttribute("aria-label", "Door " + (i + 1));
      d.addEventListener("click", () => tap(d));
      doors.push(d);
      grid.appendChild(d);
    }
    b.appendChild(grid);
    P.hearts(null);
    P.talk("Neighbours will pop out of their doors. <b>Tap each one to smile and wave!</b> 😊");
    P.acts([{ label: "▶ Start", go: start }]);

    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    function count() { P.talk("<b>😊 " + smiled + "</b> smiles · " + (VISITS - shown) + " neighbours still to come"); }
    function start() {
      P.acts([]);
      count();
      next();
    }
    function next() {
      if (over) return;
      if (shown === VISITS) { if (!live) end(); return; }
      const free = doors.filter((d) => !d.dataset.who);
      if (free.length) {
        const d = free[Math.floor(Math.random() * free.length)];
        const sad = Math.random() < 0.3;
        shown++;
        live++;
        d.dataset.who = "1";
        d.classList.add("open");
        d.classList.toggle("sad", sad);
        d.querySelector(".door-face").textContent = FOLK[Math.floor(Math.random() * FOLK.length)];
        d.querySelector(".door-mood").textContent = sad ? "😢" : "😐";
        d.setAttribute("aria-label", "A neighbour! Tap to smile");
        const stay = 3200 - shown * 80;
        d._t = setTimeout(() => close(d), stay);
        timers.push(d._t);
        count();
      }
      later(next, 1700 - shown * 40);
    }
    function tap(d) {
      if (!d.dataset.who || d.classList.contains("happy")) return;
      clearTimeout(d._t);
      smiled++;
      d.classList.add("happy");
      d.querySelector(".door-mood").textContent = "😄👋";
      FT.Audio.pop();
      count();
      later(() => close(d), 700);
    }
    function close(d) {
      if (!d.dataset.who) return;
      delete d.dataset.who;
      d.classList.remove("open", "happy", "sad");
      d.querySelector(".door-face").textContent = "🚪";
      d.querySelector(".door-mood").textContent = "";
      d.setAttribute("aria-label", "Door");
      live--;
      if (shown === VISITS && !live) end();
    }
    function end() {
      if (over) return;
      over = true;
      const s = smiled >= 10 ? 3 : smiled >= 7 ? 2 : 1;
      P.talk("<b>You smiled at " + smiled + " of " + VISITS + " neighbours!</b> A smile says “I'm happy to see you” without a single word.", s === 3 ? "great" : "ok");
      P.acts([{ label: "Finish ›", go: () => done(s, "You smiled at " + smiled + " of " + VISITS + " neighbours.") }]);
    }
    return () => { over = true; timers.forEach(clearTimeout); };
  };

  // ── Name Catcher: meet five kids, then greet each one by name ─────────────
  FT.Games.names = function (lesson, done) {
    const kids = lesson.kids;
    let misses = 0, right = 0;
    const steps = kids.map((k) => ["meet", k])
      .concat(shuffle(kids).map((k) => ["name", k]))
      .concat(shuffle(kids).slice(0, 3).map((k) => ["fact", k]));
    const MAX = steps.length - kids.length;
    let i = 0;

    function draw() {
      const [kind, k] = steps[i];
      const b = P.board();
      b.classList.add("scene");
      if (kind === "meet") {
        const st = stage(lesson.where, k);
        b.appendChild(st.el);
        st.say("Hi! I'm " + k.name + ".", "great");
        b.appendChild(h("div", "name-card", "<b>" + esc(k.name) + "</b><span>" + esc(k.name) + " " + esc(k.fact) + "</span>"));
        P.hearts(null);
        P.talk("<b>Meet " + (i + 1) + " of " + kids.length + ".</b> Say it in your head: “Hi, " + esc(k.name) + "!” Saying a name helps you keep it.");
        P.acts([{ label: i === kids.length - 1 ? "I'm ready! ›" : "Next ›", go: () => { i++; draw(); } }]);
        return;
      }
      P.hearts(right, MAX);
      const st = stage(lesson.where, kind === "name" ? { name: "???", emoji: k.emoji } : null);
      if (kind === "fact") st.el.classList.add("no-person");
      b.appendChild(st.el);
      st.say(kind === "name" ? "Hi again! Do you remember my name?" : "Who " + k.fact + "?", "think");
      const list = h("div", "choices names");
      kids.forEach((x) => {
        const btn = h("button", "choice", (kind === "fact" ? '<span class="ce" aria-hidden="true">' + x.emoji + "</span>" : "") + "<span>" + esc(x.name) + "</span>");
        btn.type = "button";
        btn.addEventListener("click", () => {
          [...list.children].forEach((y) => { y.disabled = true; });
          const ok = x === k;
          btn.classList.add("picked", ok ? "great" : "oops");
          if (ok) right++; else { misses++; list.children[kids.indexOf(k)].classList.add("best"); }
          if (kind === "name") {
            st.who(k);
            st.say(ok ? "Yes! You remembered! 😊" : "Um... I'm " + k.name + ".", ok ? "great" : "oops");
          } else st.say(ok ? "That's right, " + k.name + " " + k.fact + "!" : "It was " + k.name + "!", ok ? "great" : "oops");
          FT.Audio[ok ? "great" : "oops"]();
          P.hearts(right, MAX);
          P.talk(ok ? "<b>⭐ Spot on!</b> Hearing your own name makes you feel noticed." : "<b>😬 Not quite.</b> It was " + esc(k.name) + ". Try linking the name to something: “" + esc(k.name) + " " + esc(k.fact) + "”.", ok ? "great" : "oops");
          const last = i === steps.length - 1;
          P.acts([{ label: last ? "Finish ›" : "Next ›", go: () => { if (last) done(starsFor(misses), "You got " + right + " of " + MAX + " right."); else { i++; draw(); } } }]);
        });
        list.appendChild(btn);
      });
      b.appendChild(list);
      P.talk(kind === "name" ? "<b>Who is this?</b> Tap their name." : "<b>Remember what they told you?</b>");
      P.acts([]);
    }
    draw();
    return () => {};
  };

  // ── Good Listener: wait for your turn, then remember the story ────────────
  // The friend talks a line at a time with little thinking pauses. Cutting in
  // before the last line (which is always a question to you) costs a heart.
  // Earlier lines stay in the bubble, faded, so a slow reader isn't punished:
  // this is about waiting your turn, not a memory test.
  FT.Games.listen = function (lesson, done) {
    const timers = [];
    let s = 0, line = 0, misses = 0, hearts = 0, state = "idle";
    const MAX = lesson.stories.length * 2;
    let st, b;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers.length = 0; };

    function bubble() {
      const lines = lesson.stories[s].lines.slice(0, line + 1);
      const p = st.el.querySelector(".bubble p");
      p.innerHTML = lines.map((x, j) => '<span class="' + (j < line ? "old" : "now") + '">' + esc(x) + "</span>").join(" ");
    }
    function story() {
      b = P.board();
      b.classList.add("scene");
      st = stage(lesson.where, lesson.who);
      b.appendChild(st.el);
      line = 0;
      st.say("", "think");
      P.hearts(hearts, MAX);
      P.talk("<b>Story " + (s + 1) + " of " + lesson.stories.length + ".</b> " + esc(lesson.who.name) + " has something to tell you. Listen, and tap 💬 <b>only when it's your turn</b>.");
      P.acts([{ label: "👂 Nod", kind: "ghost", go: nod }, { label: "💬 My turn", go: myTurn }]);
      state = "talking";
      speak();
    }
    function speak() {
      const lines = lesson.stories[s].lines;
      bubble();
      st.mood("great");
      const last = line === lines.length - 1;
      if (last) { state = "yours"; st.mood("think"); return; }
      later(() => {
        st.mood("think");
        st.el.querySelector(".bubble p").insertAdjacentHTML("beforeend", ' <span class="dots">…</span>');
        later(() => { line++; speak(); }, 1000);
      }, 1800 + lines[line].length * 55);
    }
    function nod() {
      if (state !== "talking" && state !== "yours") return;
      const f = st.el.querySelector(".face");
      f.classList.remove("nod");
      void f.offsetWidth;
      f.classList.add("nod");
    }
    function myTurn() {
      if (state === "talking") {
        clear();
        misses++;
        state = "hurt";
        st.el.querySelector(".bubble p").textContent = "Hey! I wasn't finished...";
        st.mood("oops");
        FT.Audio.oops();
        P.talk("<b>😬 Oops, you cut in.</b> Wait for the question at the end. That's your turn.", "oops");
        later(() => { state = "talking"; P.talk("<b>Keep listening...</b> Tap 💬 when it's your turn."); speak(); }, 1800);
        return;
      }
      if (state !== "yours") return;
      state = "quiz";
      hearts++;
      FT.Audio.great();
      st.say("Thanks for really listening! 😊", "great");
      P.hearts(hearts, MAX);
      quiz();
    }
    function quiz() {
      const q = lesson.stories[s];
      const list = h("div", "choices");
      shuffle(q.answers).forEach((a) => {
        const btn = h("button", "choice", "<span>" + esc(a) + "</span>");
        btn.type = "button";
        btn.addEventListener("click", () => {
          [...list.children].forEach((y) => { y.disabled = true; y.classList.toggle("best", y.textContent === q.answers[0] && a !== q.answers[0]); });
          const ok = a === q.answers[0];
          btn.classList.add("picked", ok ? "great" : "oops");
          if (ok) hearts++; else misses++;
          FT.Audio[ok ? "great" : "oops"]();
          st.say(ok ? "Yes! You remembered!" : "Actually, it was " + q.answers[0] + ".", ok ? "great" : "oops");
          P.hearts(hearts, MAX);
          P.talk(ok ? "<b>⭐ Great listening!</b> People love talking to someone who really hears them." : "<b>🤔 Nearly.</b> Good listeners think about what they hear. That's how it sticks.", ok ? "great" : "oops");
          const last = s === lesson.stories.length - 1;
          P.acts([{ label: last ? "Finish ›" : "Next story ›", go: () => { if (last) done(starsFor(misses), "Friendship hearts: " + hearts + " of " + MAX + "."); else { s++; story(); } } }]);
        });
        list.appendChild(btn);
      });
      b.appendChild(list);
      P.talk("<b>Your turn!</b> " + esc(q.question));
      P.acts([]);
    }
    story();
    return () => { state = "idle"; clear(); };
  };
})();
