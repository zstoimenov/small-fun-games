/* Career Compass - turning what's on this device into the four signals.       */
/*                                                                             */
/* The roadmap's rule: "chooses to play", "does well at" and "says they liked" */
/* stay separate, because replay time is not aptitude. So every signal is kept */
/* on its own, 0..1 or null when there is nothing to go on yet. The needle     */
/* only uses the "likes" signals (quiz, ratings, plays); stars are shown       */
/* beside it as "doing well", never mixed in.                                  */
"use strict";
window.CC = window.CC || {};

(function () {
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };

  // Games that count towards a style. The Compass itself has none. GAMES is a
  // top-level const in ../games.js: shared between scripts, but not on window.
  const all = () => (typeof GAMES === "undefined" ? [] : GAMES);
  const games = () => all().filter((g) => g.compass && g.compass.length);

  // Times played. The launcher counts Play taps; a game opened before that
  // counter existed still counts once if it left a trace.
  function playsOf(folder) {
    const n = read("gamebox:plays", {})[folder] || 0;
    if (n) return n;
    return read("gamebox:played", {})[folder] || read("gamebox:progress:" + folder, null) ? 1 : 0;
  }
  const progressOf = (folder) => read("gamebox:progress:" + folder, null);

  // store: { quiz: [area id per question] | null, likes: { folder: 1 | 0 | -1 } }
  function signals(store) {
    const list = games();
    const out = {};
    CC.AREAS.forEach((a) => { out[a.id] = { quiz: null, picks: 0, likes: null, up: 0, meh: 0, down: 0, plays: null, times: 0, share: 0, games: 0, stars: null, got: 0, max: 0 }; });
    const most = Math.max(0, ...list.map((g) => playsOf(g.folder)));

    if (store.quiz) store.quiz.forEach((id) => { if (out[id]) out[id].picks++; });
    list.forEach((g) => {
      const n = playsOf(g.folder), like = store.likes[g.folder], p = progressOf(g.folder);
      g.compass.forEach((id) => {
        const s = out[id];
        if (!s) return;
        s.times += n;
        if (n) { s.share += n / most; s.games++; }
        if (like === 1) s.up++; else if (like === 0) s.meh++; else if (like === -1) s.down++;
        if (p && p.max && p.stars) { s.got += p.stars; s.max += p.max; }
      });
    });

    // Each style is in the quiz four times. Plays are the average over the
    // style's games that were played, each against the most-played game: some
    // styles have ten games and some have one, and a plain total would let the
    // big ones win just by having more games to open.
    CC.AREAS.forEach((a) => {
      const s = out[a.id];
      if (store.quiz) s.quiz = s.picks / 4;
      const rated = s.up + s.meh + s.down;
      if (rated) s.likes = ((s.up - s.down) / rated + 1) / 2;
      if (most) s.plays = s.games ? s.share / s.games : 0;
      // Only games with stars won count: a game that was just opened reports
      // 0 of 48, and that shouldn't read as "bad at it".
      if (s.max) s.stars = s.got / s.max;
      const have = [s.quiz, s.likes, s.plays].filter((v) => v != null);
      s.love = have.length ? have.reduce((x, y) => x + y, 0) / have.length : null;
    });
    return out;
  }

  // The style the needle points at, or null when there's nothing to go on.
  function top(sig) {
    let best = null;
    CC.AREAS.forEach((a) => { const v = sig[a.id].love; if (v != null && (!best || v > sig[best.id].love)) best = a; });
    return best && sig[best.id].love > 0 ? best : null;
  }

  // Played games, most played first, for the rating screen.
  function played() {
    return games().map((g) => ({ g, n: playsOf(g.folder) })).filter((x) => x.n).sort((x, y) => y.n - x.n).map((x) => x.g);
  }

  CC.Score = { signals, top, played, playsOf, games };
})();
