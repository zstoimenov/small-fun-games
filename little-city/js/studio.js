/* Little City - Be the Mayor: the screens around the mayor's map.             */
/*                                                                             */
/* Towns in progress live in store.towns (6 at most) and save after every     */
/* change, so a town can be picked up again next week. Medals won in any town */
/* are kept in store.medalsEver, even after that town is deleted.             */
"use strict";
window.LC = window.LC || {};

LC.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const M = LC.Mayor, T = LC.TYPES;
  const MAX = 6;
  const NAMES = ["Sunnyville", "Koala Creek", "Maple Town", "Rocket City", "Wattle Park", "Seaside", "Hilltop", "Bluegum Bay", "Pebble Point", "Emu Flats"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let store = null, save = null, toast = null, go = null, board = null, fresh = null;

  function init(s, onSave, onToast, opts) {
    store = s; save = onSave; toast = onToast; go = opts.go;
    if (!Array.isArray(store.towns)) store.towns = [];
    if (!Array.isArray(store.medalsEver)) store.medalsEver = [];
  }
  const town = () => store.towns.find((t) => t.id === store.current) || null;
  function keep() {
    const t = town();
    if (t) store.medalsEver = Array.from(new Set(store.medalsEver.concat(t.medals)));
    save();
  }
  function tile() {
    const t = town();
    return t ? `${t.name}: year ${t.year}` : "Run a town";
  }

  // ── The mayor's screen ─────────────────────────────────────────────────────
  function open() {
    const t = town();
    if (!t) { newTown(); return false; }
    $("sName").innerHTML = `${esc(t.name)} <small aria-hidden="true">✏️</small>`;
    board = LC.mayorBoard($("sEditor"), t, { board: $("mBoard"), onChange: () => { keep(); header(); }, locked: () => t.over });
    header();
    return true;
  }
  // The whole story behind a news chip, told in the talk panel.
  let shownOffer = null;
  function news(kind) {
    const t = town();
    if (kind === "campaign" && t.campaign) {
      const poll = M.tally(t), tot = poll.total || 1;
      const row = (e, name, v, promise, you) => `<div class="cand${you ? " you" : ""}"><span class="ce">${e}</span><div><b>${name}</b>${promise ? `<small>“${esc(promise)}”</small>` : ""}<div class="bar"><i style="width:${Math.round(100 * v / tot)}%"></i></div></div><span class="pc">${Math.round(100 * v / tot)}%</span></div>`;
      board.say(`<p class="who">🗳️ Election at the end of this year!</p>` +
        row("🧑‍💼", "You", poll.votes.mayor, "", true) + t.campaign.rivals.map((rv, k) => row(rv.e, rv.name, poll.votes["r" + k], rv.promise)).join("") +
        `<p class="muted">This poll changes as you build. Fix what the rivals promise to win those families back!</p>`);
    }
    if (kind === "request" && t.request) {
      const q = t.request;
      board.say(`<p class="who">✉️ A letter from the ${q.fam} family</p><p class="bubble">“Please build a ${T[q.need].e} ${T[q.need].name.toLowerCase()} near our house (circled) by the end of year ${q.due}!”</p><p>Thank-you: <b>${q.reward}</b> coins.</p>`);
    }
    if (kind === "offer" && t.offer && !t.over) {
      const off = t.offer;
      // The short version: the year card told the whole story.
      const short = { factory: `A juice company wants a noisy factory next to homes (circled). They'll pay ${off.coins} coins.`, house: "A builder will build a house for free on the circled square.", sellpark: `Someone will pay ${off.coins} coins to turn the circled park into a car park.` }[off.kind] || esc(off.text);
      board.say(`<p class="who">🤝 An offer: say yes?</p><p>${short}</p>`);
      const row = document.createElement("div");
      row.className = "offer-acts";
      const mk = (cls, text, yes) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = cls; b.textContent = text;
        b.addEventListener("click", () => {
          const o = M.answer(t, yes);
          keep(); board.paint(); header();
          board.say(yes ? `<p>👍 You said yes!${o && o.coins ? ` +${o.coins} coins.` : ""}</p>` : "<p>👎 You said no, thank you.</p>");
          if (yes) LC.Audio.right(); else LC.Audio.click();
        });
        row.appendChild(b);
      };
      mk("btn ghost small", "👎 No thanks", false);
      mk("btn go small", "👍 Yes", true);
      $("sEditor").querySelector(".talk").appendChild(row);
    }
  }
  function header() {
    const t = town();
    if (!t) return;
    const st = board.look();
    const rk = M.RANKS[t.rank], next = M.RANKS[t.rank + 1];
    $("mRank").innerHTML = `${rk.e} ${rk.name}` + (next ? `<small>${Math.max(0, next.at - st.people)} more people to ${next.name}</small>` : "");
    const happy = st.people ? Math.round(100 * st.happy / st.people) : 0;
    $("mStats").innerHTML = `<span>📅 Year <b>${t.year}</b>${t.mode === "challenge" ? ` of ${M.CHALLENGE_YEARS}` : ""}</span>` +
      `<span title="People living here / room in all the homes">👥 <b>${st.people}/${st.capacity}</b></span><span>😀 <b>${happy}%</b></span>` +
      `<span class="${t.coins < 10 ? "bad" : ""}">💰 <b>${t.coins}</b></span>` +
      `<span class="${st.balance < 0 ? "bad" : ""}" title="What the next year will add or take">📈 <b>${st.balance >= 0 ? "+" : ""}${st.balance}</b>/yr</span>` +
      (t.loan ? `<span class="bad">🏦 owe <b>${t.loan}</b></span>` : "");
    // The news: a chip each for the election, a family's letter and an offer.
    // A chip is one short line; tapping it tells the whole story in the talk
    // panel, next to the map, so the news never squeezes the map out.
    // A finished town has no news left to act on.
    const c = t.over ? null : t.campaign, q = t.over ? null : t.request, off = t.over ? null : t.offer;
    $("mCampaign").hidden = !c;
    if (c) {
      const poll = M.tally(t), tot = poll.total || 1;
      $("mCampaign").innerHTML = `🗳️ You <b>${Math.round(100 * poll.votes.mayor / tot)}%</b>`;
      $("mCampaign").setAttribute("aria-label", "Election this year: tap to see the poll");
    }
    $("mRequest").hidden = !q;
    if (q) { $("mRequest").innerHTML = `✉️ ${T[q.need].e} yr ${q.due}`; $("mRequest").setAttribute("aria-label", "A letter from the " + q.fam + " family: tap to read it"); }
    $("mOffer").hidden = !off;
    if (off) $("mOffer").innerHTML = "🤝 Offer!";
    // A new offer opens itself, so its Yes and No are in sight straight away.
    if (off && shownOffer !== off) { shownOffer = off; news("offer"); }
    $("mOver").hidden = !t.over;
    if (t.over) {
      const sc = M.score(t);
      $("mOver").innerHTML = t.lost
        ? `<p><b>🗳️ You lost the election in year ${t.year - 1}.</b></p>`
        : `<p><b>🏁 Your 20 years as mayor are over!</b> Score ${sc.pts} ${"⭐".repeat(sc.stars)}</p>`;
      if (t.lost && t.snap) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn small"; b.textContent = "↺ Try that year again";
        b.addEventListener("click", retry);
        $("mOver").appendChild(b);
      }
    }
    $("mEnd").disabled = t.over;
  }

  // ── End the year ───────────────────────────────────────────────────────────
  function endYear() {
    const t = town();
    if (!t || t.over) return;
    const before = board.look();
    const sum = M.endYear(t);
    keep();
    // A new year starts with 👆 Look, so nothing gets built by accident.
    board.reset();
    board.marks(sum.marks);
    board.burst(sum, before);
    header();
    LC.Audio.build();
    setTimeout(() => yearCard(sum), window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
  }
  const WHY = { road: "no road", school: "no school nearby", clinic: "no clinic nearby", fire: "no fire station nearby", shop: "no shop nearby", park: "no park nearby", noise: "a noisy factory next door", job: "no jobs nearby", police: "no police nearby", repair: "storm damage", quiet: "too busy next door", green: "no nature next door" };
  function yearCard(sum) {
    const t = town();
    const body = $("yBody"), acts = $("yActs");
    $("yTitle").textContent = `Year ${sum.year} is over!`;
    let h = "";
    const ev = sum.event;
    h += `<div class="event card"><span class="ev-e" aria-hidden="true">${ev.e}</span><div><b>${esc(ev.title)}</b><p>${esc(ev.text)}</p></div></div>`;
    const why = Object.entries(sum.why).sort((a, b) => b[1] - a[1]).map(([k]) => WHY[k]).filter(Boolean).slice(0, 2).join(" and ");
    h += `<ul class="year-list"><li>🚚 <b>${sum.inn}</b> people moved in${sum.out ? `, 🚪 <b>${sum.out}</b> moved out${why ? ` (${why})` : ""}` : ""}. Now <b>${sum.people}</b> live here.</li>`;
    h += `<li>💰 Taxes <b>+${sum.tax}</b>${sum.earn ? `, shops and work <b>+${sum.earn}</b>` : ""}${sum.upkeep ? `, running costs <b>-${sum.upkeep}</b>` : ""}${sum.interest ? `, loan interest <b>-${sum.interest}</b>` : ""} = <b>${sum.balance >= 0 ? "+" : ""}${sum.balance}</b>. The town has <b>${sum.coins}</b> coins.</li>`;
    sum.news.forEach((n) => { h += `<li>${esc(n)}</li>`; });
    h += "</ul>";
    if (sum.election) {
      const e = sum.election, tot = e.total || 1;
      const row = (em, name, v, you) => `<div class="cand${you ? " you" : ""}"><span class="ce">${em}</span><div><b>${name}</b><div class="bar"><i style="width:${Math.round(100 * v / tot)}%"></i></div></div><span class="pc">${v} vote${v === 1 ? "" : "s"}</span></div>`;
      h += `<div class="election card"><p class="kicker">🗳️ Election results</p>${row("🧑‍💼", "You", e.votes.mayor, true)}${e.rivals.map((rv, k) => row(rv.e, rv.name, e.votes["r" + k])).join("")}` +
        (e.thanks ? `<p class="muted">✉️ Families you helped brought ${e.thanks} extra votes!</p>` : "") +
        (e.won ? `<p class="big-win">🎉 You won! Welcome to term ${t.term} as mayor.</p>` : `<p class="big-lose">${e.winner.e} ${e.winner.name} won the election. Families wanted: “${esc(e.winner.promise)}”</p>`) + "</div>";
    }
    if (sum.medals.length) h += `<div class="medals-won">${sum.medals.map((id) => { const m = M.MEDALS.find((x) => x.id === id); return `<span class="medal on">${m.e}<b>${m.name}</b></span>`; }).join("")}</div>`;
    if (sum.final && !t.lost) h += `<div class="final card"><p class="kicker">🏁 20 years as mayor!</p><p class="big-stars">${"★".repeat(sum.final.stars)}<span class="dim">${"★".repeat(3 - sum.final.stars)}</span></p><p>Score <b>${sum.final.pts}</b>: ${sum.final.people} people, ${sum.final.happy} happy, plus savings, minus any loan.</p></div>`;
    body.innerHTML = h;
    acts.innerHTML = "";
    const btn = (cls, text, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; b.addEventListener("click", fn); acts.appendChild(b); return b; };
    if (ev.choice && t.offer) body.insertAdjacentHTML("beforeend", '<p class="why">🤝 The offer waits next to the map: look at the circled square, then answer 👍 or 👎 before you end the year.</p>');
    nextBtn();
    // Anything the news was about is ringed on the map: this closes the card
    // and shows it, with the headline kept beside the map.
    if (sum.marks.length) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost show-me";
      b.textContent = "📍 Show me on the map";
      b.addEventListener("click", () => {
        $("yearDialog").close();
        board.show(sum.marks);
        if (ev.choice && t.offer) { news("offer"); return; }
        board.say(`<p class="who">${ev.e} ${esc(ev.title)}</p><p>${esc(ev.text)}</p>` + sum.news.map((n) => `<p>${esc(n)}</p>`).join("") +
          `<p class="muted">📍 The rings show where it happened. 🚪 = families moved out.</p>`);
      });
      acts.prepend(b);
    }
    function nextBtn() {
      if (t.lost && t.snap) { btn("btn ghost", "Finish", () => $("yearDialog").close()); btn("btn go", "↺ Try that year again", () => { $("yearDialog").close(); retry(); }); }
      else btn("btn go", t.over ? "See my town" : `On to year ${t.year} ›`, () => $("yearDialog").close());
    }
    if (sum.medals.length || (sum.election && sum.election.won)) LC.Audio.win(); else if (sum.election) LC.Audio.wrong();
    $("yearDialog").showModal();
  }
  function retry() {
    const t = town();
    const back = M.retry(t);
    if (!back) return;
    store.towns[store.towns.indexOf(t)] = back;
    keep();
    open();
    toast("Back to the start of the election year. You can do it! 🗳️");
  }

  // ── The bank ───────────────────────────────────────────────────────────────
  function bank() {
    const t = town();
    if (!t) return;
    const lim = M.loanLimit(t);
    $("bankBody").innerHTML = `<p>💰 The town has <b>${t.coins}</b> coins.</p><p>🏦 You owe the bank <b>${t.loan}</b> coins. Interest: <b>${Math.ceil(t.loan * 0.1)}</b> coins a year.</p><p class="muted">The bank will lend up to ${lim} coins in total: bigger towns can borrow more.</p>`;
    $("bBorrow").disabled = t.over || t.loan >= lim;
    $("bRepay").disabled = $("bRepayAll").disabled = t.over || !t.loan || !t.coins;
    if (!$("bankDialog").open) $("bankDialog").showModal();
  }
  function bankDo(fn) { const t = town(); const err = fn(t); if (err) toast(err); else LC.Audio.right(); keep(); board.paint(); header(); bank(); }

  // ── Medals ─────────────────────────────────────────────────────────────────
  function medals() {
    const t = town();
    const have = new Set(store.medalsEver.concat(t ? t.medals : []));
    $("medalInfo").textContent = `${have.size} of ${M.MEDALS.length} medals won. Medals from every town count!`;
    $("medalGrid").innerHTML = M.MEDALS.map((m) => `<div class="medal${have.has(m.id) ? " on" : ""}"><span aria-hidden="true">${have.has(m.id) ? m.e : "🔒"}</span><b>${m.name}</b><small>${m.text}</small></div>`).join("");
    $("medalDialog").showModal();
  }

  // ── A new town ─────────────────────────────────────────────────────────────
  function newTown() {
    if (store.towns.length >= MAX) { toast(`You have ${MAX} towns. Delete one in 🏙️ My towns first!`); return; }
    fresh = { name: pick(NAMES), mode: "endless", seed: Math.floor(Math.random() * 1e9) };
    paintNew();
    $("newDialog").showModal();
  }
  function paintNew() {
    $("nName").innerHTML = `${esc(fresh.name)} <small aria-hidden="true">✏️</small>`;
    const modes = [{ id: "endless", e: "♾️", name: "Keep going", sub: "Grow forever. Elections every 4 years." }, { id: "challenge", e: "🏁", name: "20-year challenge", sub: "Get the best score in 20 years." }];
    $("nMode").innerHTML = "";
    modes.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mode" + (fresh.mode === m.id ? " on" : "");
      b.setAttribute("aria-pressed", String(fresh.mode === m.id));
      b.innerHTML = `<span aria-hidden="true">${m.e}</span><b>${m.name}</b><small>${m.sub}</small>`;
      b.addEventListener("click", () => { fresh.mode = m.id; paintNew(); });
      $("nMode").appendChild(b);
    });
    const mp = M.makeMap(fresh.seed);
    $("nMap").innerHTML = LC.mapSvg(mp.grid, null, { small: true, spots: mp.spots, attrs: 'role="img" aria-label="Your new map"' });
    $("nLand").textContent = `${mp.land.e} ${mp.land.name}` + (mp.spots ? " · 🏰 a castle · 🪨 rocky ground" : "");
  }
  function start() {
    const t = M.create(fresh.name, fresh.mode, fresh.seed);
    store.towns.unshift(t);
    store.current = t.id;
    keep();
    $("newDialog").close();
    go();
  }

  function rename() {
    const target = $("newDialog").open ? fresh : town();
    if (!target) return;
    const n = prompt("What's your town called?", target.name);
    if (n == null || !n.trim()) return;
    target.name = n.trim().slice(0, 24);
    if ($("newDialog").open) paintNew(); else { keep(); open(); }
  }

  // ── My towns ───────────────────────────────────────────────────────────────
  function gallery() {
    const box = $("townList");
    box.innerHTML = "";
    const have = new Set(store.medalsEver);
    $("townsInfo").textContent = `${store.towns.length} of ${MAX} towns · 🏅 ${have.size} of ${M.MEDALS.length} medals`;
    if (!store.towns.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">🏙️</p><p><b>No towns yet.</b></p><p>Start a new town and be its mayor!</p></div>';
      return;
    }
    store.towns.forEach((t) => {
      const st = M.look(t), rk = M.RANKS[t.rank];
      const card = document.createElement("div");
      card.className = "town card";
      const status = t.lost ? "🗳️ Lost an election" : t.over ? `🏁 Finished · ${"⭐".repeat(M.score(t).stars)}` : t.mode === "challenge" ? `🏁 Year ${t.year} of ${M.CHALLENGE_YEARS}` : `♾️ Year ${t.year}`;
      card.innerHTML = `<div class="thumb">${LC.mapSvg(t.grid, st, { spots: t.spots, attrs: 'aria-hidden="true"' })}</div><div class="town-body"><b>${esc(t.name)}</b><small>${rk.e} ${rk.name} · 👥 ${st.people} · 💰 ${t.coins}</small><small>${status}</small></div>`;
      const acts = document.createElement("div");
      acts.className = "town-acts";
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + t.name); b.addEventListener("click", fn); return b; };
      acts.append(
        mk("btn small", t.over ? "Look" : "Continue", "Open", () => { store.current = t.id; save(); go(); }),
        mk("icon-btn", "🗑️", "Delete", () => {
          if (!confirm("Delete " + t.name + "? Its medals stay yours.")) return;
          store.towns = store.towns.filter((x) => x.id !== t.id);
          if (store.current === t.id) store.current = null;
          save();
          gallery();
        }));
      card.appendChild(acts);
      box.appendChild(card);
    });
  }

  function wire() {
    $("mEnd").addEventListener("click", endYear);
    ["campaign", "request", "offer"].forEach((k) => $("m" + k[0].toUpperCase() + k.slice(1)).addEventListener("click", () => { LC.Audio.click(); news(k); }));
    $("mBank").addEventListener("click", bank);
    $("mMedals").addEventListener("click", medals);
    $("bBorrow").addEventListener("click", () => bankDo((t) => M.borrow(t, 20)));
    $("bRepay").addEventListener("click", () => bankDo((t) => M.repay(t, 20)));
    $("bRepayAll").addEventListener("click", () => bankDo((t) => M.repay(t, t.loan)));
    $("nReroll").addEventListener("click", () => { fresh.seed = Math.floor(Math.random() * 1e9); paintNew(); });
    $("nStart").addEventListener("click", start);
    $("nName").addEventListener("click", rename);
  }

  return { init, open, tile, gallery, newTown, rename, wire, current: town };
})();
