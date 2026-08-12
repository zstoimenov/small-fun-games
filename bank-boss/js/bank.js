/* Bank Boss — the whole model, and nothing else.                               */
/*                                                                              */
/* Pure: no DOM, no clock, no Math.random, nothing read from outside the         */
/* arguments. That is what lets tools/bank-check.js load this file into plain    */
/* node and play thousands of runs to find out whether the game teaches what it  */
/* claims. Every number below was measured by that harness, not chosen.          */
/*                                                                              */
/* THE MONEY RULE, inherited from Lemonade Stand and worth every line it costs:  */
/*                                                                              */
/*   Every amount is a whole number of CENTS in a JS integer, and every amount a */
/*   child ever sees is a multiple of 5c, because Australia has no 1c coin. A    */
/*   RATE is not a coin — "2c a night for every dollar" is quoted to the cent    */
/*   like a real interest rate and never has to be 5c-clean.                     */
/*                                                                              */
/* THE BALANCE RULE, which is this game's own:                                   */
/*                                                                              */
/*   cash + loansOut - deposits === own,  at every instant, to the cent.         */
/*                                                                              */
/*   That one line IS how a bank works. The coins in the vault plus the coins    */
/*   out on loan, minus what you owe your savers, is the only money that is      */
/*   actually yours. Every function that moves money moves two of those four     */
/*   numbers and leaves the identity standing; check() asserts it, and the       */
/*   harness calls check() after literally every event.                          */
/*                                                                              */
/* THE NIGHT RULE, which the second pass added and which is why the game is now  */
/* followable: interest lands EVERY night in BOTH directions, on the balance     */
/* outstanding, at the rate on the dial. Borrowers pay their interest in coins   */
/* each night and hand the borrowed money itself back on the day it falls due.   */
/* Before this, savers were paid nightly but loans only paid at maturity, so a   */
/* child playing well watched their own money fall for the first half of the run */
/* and jump at the end — a score that moves in the opposite direction to the     */
/* play teaches the opposite of the lesson.                                      */
"use strict";
window.BB = window.BB || {};

BB.Bank = (function () {
  /* ── Money ─────────────────────────────────────────────────────────────── */

  // Round to the nearest 5c, half up. The only rounding function in the game.
  // The inner Math.round is what makes it honest about fractions: interest is a
  // rate times a balance and lands on halves of a cent all the time, and
  // (c + 2) on its own quietly rounded those DOWN by up to 3c instead of to the
  // nearest nickel. Integer in, integer out, and never more than 2.5c of drift.
  const cents5 = (c) => Math.floor((Math.round(c) + 2) / 5) * 5;

  // Display only. Never feed the result back into a calculation.
  function money(c) {
    const neg = c < 0;
    const v = Math.abs(c);
    const s = v % 100 === 0 ? "$" + v / 100 + ".00" : "$" + (v / 100).toFixed(2);
    return neg ? "-" + s : s;
  }

  // The small-change voice: 65c reads better than $0.65 on a button.
  const price = (c) => (Math.abs(c) < 100 ? c + "c" : money(c));

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

  /* ── The two dials ─────────────────────────────────────────────────────── */

  // Cents per dollar per night. Three of each, tiles not typed numbers.
  //
  // The ladder is deliberately narrow. What matters is not the absolute rate but
  // the GAP: you pay savers on every dollar they leave with you, whether it is
  // earning anything or not, and you collect on the dollars you managed to lend.
  // Spread 1c is a rounding error, spread 7c is a bank nobody uses.
  const SAVE_RATES = [1, 2, 3];
  const LOAN_RATES = [6, 8, 10];

  /* ── The town ──────────────────────────────────────────────────────────── */

  // Twenty named people with faces, because a child should learn that Nan always
  // pays you back and Dodgy Dave does not. A person's star rating never changes,
  // so it is knowledge worth having rather than a dice roll wearing a badge.
  //
  // stars: 3 = pays you back nearly always, 2 = usually, 1 = often doesn't.
  const TOWN = [
    { id: "nan", name: "Nan", emoji: "👵", star: 3 },
    { id: "pat", name: "Mrs Patel", emoji: "👩‍🏫", star: 3 },
    { id: "doc", name: "Dr Ada", emoji: "👩‍⚕️", star: 3 },
    { id: "bak", name: "Bruno the baker", emoji: "👨‍🍳", star: 3 },
    { id: "far", name: "Farmer Fay", emoji: "👩‍🌾", star: 3 },
    { id: "pos", name: "Postie Pete", emoji: "📮", star: 3 },
    { id: "lib", name: "Miss Lin", emoji: "📚", star: 3 },
    { id: "cop", name: "Sergeant Sam", emoji: "👮", star: 3 },
    { id: "gra", name: "Grandad Joe", emoji: "👴", star: 3 },

    { id: "kid", name: "Milo", emoji: "🧒", star: 2 },
    { id: "art", name: "Ivy the artist", emoji: "👩‍🎨", star: 2 },
    { id: "mec", name: "Mo the mechanic", emoji: "🧑‍🔧", star: 2 },
    { id: "sur", name: "Surfer Sky", emoji: "🏄", star: 2 },
    { id: "mus", name: "Rex on drums", emoji: "🥁", star: 2 },
    { id: "gar", name: "Greta", emoji: "🧑‍🌾", star: 2 },
    { id: "cyc", name: "Wheels Wanda", emoji: "🚴", star: 2 },

    { id: "dav", name: "Dodgy Dave", emoji: "🕶️", star: 1 },
    { id: "gus", name: "Lucky Gus", emoji: "🎰", star: 1 },
    { id: "zed", name: "Zed", emoji: "🃏", star: 1 },
    { id: "vee", name: "Vinnie", emoji: "🧢", star: 1 }
  ];

  const person = (id) => TOWN.find((p) => p.id === id) || TOWN[0];

  // How often a loan is simply never paid back, by star. These are the numbers
  // the whole game balances on, so here is the arithmetic they were chosen for.
  //
  // A borrower pays interest every night and hands the money itself back on the
  // due day, so a loan of $1 for n nights at r cents a night earns r*n/100 and
  // risks the dollar. Divide the risk by the nights and it is a rate like any
  // other, directly comparable with the number on the dial:
  //
  //   what a star is really worth, per dollar per night = r - default*(1-recovery)*100/n
  //
  // At n = 4.5 nights that loss works out at 0.9c, 2.0c and 10.7c a night. Set
  // against the middle 8c loan rate and 2c paid to savers that is +5.1c, +4.0c
  // and -4.7c — so the ladder is legible and, more importantly, NO rate on the
  // dial makes a one-star loan worth taking: at the dearest 10c it is still
  // -2.7c a night. Dodgy Dave is not a gamble that pays if you charge enough,
  // and the harness asserts exactly that.
  const DEFAULT_RATE = { 3: 0.08, 2: 0.18, 1: 0.48 };

  // What comes back when a loan goes wrong. Somebody reliable who hits trouble
  // pays back what they can; somebody who was never going to pay you simply
  // does not. Two things were bought with this, and the second is the important
  // one: "Ivy could only pay back half" is a better beat at the counter than a
  // coin landing badly, AND halving the size of a bad debt while doubling how
  // often one happens leaves the average untouched and cuts the swing by more
  // than half.
  const RECOVERY = { 3: 0.5, 2: 0.5, 1: 0 };

  // Who says yes to your loan rate. THIS is the trap the game is built around:
  // the reliable people can shop around or do without, and the risky ones cannot.
  // Charge the most and the only people who still walk through the door are the
  // ones who were never going to pay you back.
  const ACCEPT = {
    3: { 6: 0.92, 8: 0.72, 10: 0.20 },
    2: { 6: 0.96, 8: 0.86, 10: 0.45 },
    1: { 6: 1.00, 8: 1.00, 10: 0.95 }
  };

  // Who leaves money with you at all, by what you pay them. A saver who does not
  // like your rate keeps it under the mattress, which is the honest answer to
  // "why does a bank pay you anything?" and does not need a bank across the
  // street to explain it.
  const DEPOSIT_CHANCE = { 1: 0.35, 2: 0.70, 3: 0.92 };

  const TOWNSFOLK = 20;                 // how many people there are to win over

  /* ── Amounts ───────────────────────────────────────────────────────────── */

  // A deposit is one person's savings; a loan is several people's savings lent
  // to one of them, so the two tables are a different size on purpose. Nan's $25
  // and Postie Pete's $30 are what Mo's $60 van repair is actually made of, and
  // the vault picture shows exactly that.
  const DEPOSITS = [2000, 2500, 3000, 4000, 5000, 7000];
  const BORROWS = [3000, 4000, 5000, 6000, 8000, 10000];

  const REASONS = ["a scooter", "a puppy", "a new bike", "a guitar", "fixing the van",
    "a birthday party", "footy boots", "a greenhouse", "a surfboard", "a holiday",
    "a fridge", "a fishing boat"];

  /* ── Constants ─────────────────────────────────────────────────────────── */

  // $60.00 of your own money — roughly what one person will ask to borrow. Small
  // on purpose: from the second day on, nearly every coin you lend is somebody
  // else's, which is the fact the vault picture exists to show. Big enough that
  // one borrower running off with the lot does not end the run on day two.
  const START_OWN = 6000;

  // Trust is a COUNT, not a score: how many of the twenty townsfolk use your
  // bank. It decides how many people walk in and how much they trust you with.
  const START_TRUST = 6;

  // Calling your loans in early. Nobody hands a lender back the full amount for
  // the privilege of paying early, so you get 75c in the dollar and the missing
  // 25c comes straight off your own money. It is the only real punishment in the
  // game, and it exists so that "keep enough coins back" is a rule with teeth.
  const FIRE_SALE = 0.75;

  // How far ahead the keep-back number looks. Savers say when they want their
  // money and the morning board prints it, so this is not a superstition about a
  // quarter of the book — it is the coins you have already promised to somebody.
  //
  // A flat quarter of deposits was what the first pass shipped, and it failed the
  // only test that matters for an 8-year-old: there was no way to tell from the
  // screen whether it was about to bite. Two nights of promises is a number the
  // child can check against the board and be right about.
  const RESERVE_NIGHTS = 2;

  const LEVELS = {
    short: {
      days: 7, queue: [4, 6],
      goal: [6700, 7600, 8800, 10600],
      rungs: ["🪙 a money box", "💼 a proper cash desk", "🏪 a shop on the corner", "🏛️ a real bank"]
    },
    normal: {
      days: 10, queue: [5, 7],
      goal: [6900, 8600, 10800, 14000],
      rungs: ["🪙 a money box", "💼 a proper cash desk", "🏪 a shop on the corner", "🏛️ a real bank"]
    }
  };

  const spec = (d) => LEVELS[d] || LEVELS.normal;

  /* ── A bank ────────────────────────────────────────────────────────────── */

  function newBank() {
    return {
      cash: START_OWN,                  // coins actually in the vault
      loansOut: 0,                      // coins out with borrowers, at face value
      deposits: 0,                      // what you owe savers, interest included
      own: START_OWN,                   // cash + loansOut - deposits
      saveRate: 2,
      loanRate: 8,
      savers: [],                       // {id, amount, paid, due}
      loans: [],                        // {id, star, amount, due, why}
      trust: START_TRUST,
      // Your history with each person, which is the data the first pass never
      // kept and the reason nothing on screen could be reasoned from. Nothing in
      // the model reads it — it exists so the child can.
      record: {},                       // id -> {lent, repaid, broke, cost, saved}
      fires: 0,
      badDebts: 0, earned: 0, paidOut: 0, lost: 0
    };
  }

  const noteOn = (bank, id) => (bank.record[id] =
    bank.record[id] || { lent: 0, repaid: 0, broke: 0, cost: 0, saved: 0 });

  // The balance rule, computed the slow obvious way and compared with the
  // running numbers. Every game in this repo that computed something twice found
  // something; this is that habit applied to the one identity the game is about.
  function check(bank, closing) {
    const owed = sum(bank.savers, (s) => s.amount + s.paid);
    const out = sum(bank.loans, (l) => l.amount);
    if (owed !== bank.deposits) return "deposits " + bank.deposits + " but savers hold " + owed;
    if (out !== bank.loansOut) return "loansOut " + bank.loansOut + " but loans total " + out;
    if (bank.cash + bank.loansOut - bank.deposits !== bank.own) {
      return "cash " + bank.cash + " + out " + bank.loansOut + " - owed " + bank.deposits +
        " != own " + bank.own;
    }
    // Cash may only go negative at closing time, where it is a synonym for "the
    // bank owed more than it had". During play it is a hard floor: you cannot
    // hand out coins you have not got.
    if (bank.cash < 0 && !closing) return "cash went negative: " + bank.cash;
    for (const v of [bank.cash, bank.loansOut, bank.deposits, bank.own]) {
      if (!Number.isInteger(v)) return "not a whole number of cents: " + v;
      if (v % 5 !== 0) return "not 5c-clean: " + v;
    }
    return null;
  }

  /* ── What the child is told ────────────────────────────────────────────── */

  // The heaps the vault picture draws. Everything on it comes from here so the
  // picture and the model cannot disagree.
  function heaps(bank) {
    return {
      owed: bank.deposits,        // 🟦 savers' coins — you owe every one back
      out: bank.loansOut,         // 🟧 out on loan — not in the room right now
      own: bank.own,              // 🟩 yours
      cash: bank.cash             // what is actually in the vault
    };
  }

  // Coins you have already promised to somebody in the next couple of days. This
  // is the keep-back number, and unlike a flat percentage it can be checked
  // against the morning board: every dollar of it has a name next to it.
  function reserveNeeded(run, bank) {
    const until = run.day + RESERVE_NIGHTS - 1;
    return sum(bank.savers.filter((s) => s.due <= until), (s) => s.amount + s.paid);
  }

  // Who that money is promised to, for the morning board and the vault chip.
  function dueSoon(run, bank) {
    const until = run.day + RESERVE_NIGHTS - 1;
    return bank.savers.filter((s) => s.due <= until)
      .map((s) => ({ id: s.id, amount: s.amount + s.paid, due: s.due }))
      .sort((a, b) => a.due - b.due);
  }

  const spare = (run, bank) => bank.cash - reserveNeeded(run, bank);

  // What a loan earns you, stated in full the moment it is offered. Interest is
  // paid nightly, so this is the sum of the nights rather than a lump at the end
  // — and it is quoted both ways round because "70c a night" and "$3.50 in all"
  // are the same fact and a child needs to meet both.
  const nightlyOn = (amount, rate) => cents5((amount * rate) / 100);
  const interestOver = (amount, rate, nights) => cents5((amount * rate * nights) / 100);

  /* ── Starting a run ────────────────────────────────────────────────────── */

  // Three people already bank with you on day one. This is not a leg-up, it is
  // what makes the first screen mean anything: an empty vault has nothing to
  // show, and the whole game is a picture of whose coins are in the vault.
  //
  // It is also what stops the opening being cash-starved. Measured without it,
  // a third of the borrowers on the first few days were turned away for the
  // dullest possible reason — the coins were not there yet.
  const OPENING = [["nan", 2000, 5], ["pos", 2500, 7], ["lib", 1500, 9]];

  function openingBook(bank) {
    for (const [id, amount, due] of OPENING) {
      bank.savers.push({ id, amount, paid: 0, due });
      bank.cash += amount;
      bank.deposits += amount;
      noteOn(bank, id).saved += amount;
    }
    return bank;
  }

  function newRun(difficulty, seed) {
    const sp = spec(difficulty);
    return {
      difficulty, seed,
      days: sp.days, day: 1, phase: "rates",
      bank: openingBook(newBank()),
      queue: [], at: 0,
      report: null,
      // One row per night, and the row IS the night screen. It doubles as the
      // history the morning board reads back, which is the whole answer to
      // "there is no data you can follow": every choice the child makes is
      // printed next to what it came to.
      ledger: []
    };
  }

  /* ── The day's queue ───────────────────────────────────────────────────── */

  // Generated once, at the top of the day, from (seed, day) — so a resumed run
  // meets exactly the same people in the same order, and so the morning board
  // can print who is coming before the doors open.
  //
  // Nobody is a surprise any more. The first pass sprang random withdrawals on
  // the child, which made keeping coins back a superstition rather than a sum;
  // now every dollar that is going to leave today is on the board at the top of
  // the morning, and "keep back what you have promised" is a rule that can be
  // followed and seen to work.
  function startDay(run) {
    const sp = spec(run.difficulty);
    const bank = run.bank;
    const rng = BB.Rng.stream(run.seed, run.day * 7919 + 13);
    const left = run.days - run.day;          // nights still to run after tonight
    const used = {};
    const queue = [];

    bank.today = { took: 0, lent: 0, paidOut: 0, interestOut: 0, interestIn: 0,
      badDebt: 0, refused: 0, fire: 0, missed: 0, backIn: 0, back: [], bad: [] };

    // Loans falling due come home FIRST, before the doors open — which is not a
    // detail, it is what makes the keep-back number honest. Settled at night
    // instead, a loan due today paid out hours after the saver it was supposed
    // to cover had already been turned away, so a bank following the rule to the
    // letter still had a fire sale in a third of runs. A rule that does not work
    // when obeyed is worse than no rule.
    settleDue(run);

    // Savers whose day has come, first in the queue, because being paid back is
    // the promise the whole reserve rule is about.
    for (const s of bank.savers) {
      if (s.due !== run.day) continue;
      used[s.id] = true;
      queue.push({ kind: "withdraw", id: s.id, amount: s.amount + s.paid });
    }

    const size = rng.between(sp.queue[0], sp.queue[1]);
    const trustFrac = bank.trust / TOWNSFOLK;
    while (queue.length < size) {
      const free = TOWN.filter((p) => !used[p.id]);
      if (!free.length) break;
      const p = free[rng.int(free.length)];
      used[p.id] = true;

      // A borrower whose loan would fall due after the last day never turns up:
      // the run has to end with the books straight, or the last screen is a
      // muddle about money that never came back.
      const kind = left >= 1 && rng.chance(0.6) ? "borrow" : "save";

      if (kind === "save") {
        // A saver names the day they will want it back, and that day is allowed
        // to fall after the run ends — closeUp() hands those savers their money
        // at no cost. Clamping them to the last day instead put every saver in
        // the town at the counter on the final morning, which is a bank run, and
        // a fully-lent bank had one in every single run. The game's one real
        // punishment must be something the child did.
        const nights = rng.between(3, 6);
        queue.push({ kind: "save", id: p.id,
          amount: scaled(rng.pick(DEPOSITS), trustFrac), nights });
      } else {
        const nights = Math.min(rng.between(2, 5), left);
        queue.push({ kind: "borrow", id: p.id,
          amount: scaled(rng.pick(BORROWS), trustFrac), nights,
          why: rng.pick(REASONS) });
      }
    }

    run.queue = queue;
    run.at = 0;
    run.report = null;
    run.phase = "rates";
    return run;
  }

  // Loans whose day has come. The money itself walks back in — or it doesn't.
  // Whether it does is a roll taken from the loan's own salt, so it cannot be
  // re-rolled by a save and a reload.
  function settleDue(run) {
    const bank = run.bank;
    for (const l of bank.loans.slice()) {
      if (l.due > run.day) continue;
      const rng = BB.Rng.stream(run.seed, hash(l.id) + l.due * 977 + l.amount);
      const paid = rng.next() >= DEFAULT_RATE[l.star];
      bank.loans.splice(bank.loans.indexOf(l), 1);
      bank.loansOut -= l.amount;
      const note = noteOn(bank, l.id);
      if (paid) {
        bank.cash += l.amount;
        note.repaid++;
        bank.today.backIn += l.amount;
        bank.today.back.push({ id: l.id, amount: l.amount, why: l.why });
      } else {
        const back = cents5(l.amount * RECOVERY[l.star]);
        const lost = l.amount - back;
        bank.cash += back;
        bank.own -= lost;
        bank.badDebts += lost;
        bank.today.badDebt += lost;
        note.broke++;
        note.cost += lost;
        bank.today.bad.push({ id: l.id, amount: l.amount, back, lost, star: l.star });
      }
    }
  }

  // Business grows with the town's confidence. Without this the deposit base
  // reaches its steady state in about five days and the second half of the run
  // is the first half again.
  function scaled(base, trustFrac) {
    return Math.round((base * (0.45 + 1.1 * trustFrac)) / 50) * 50;
  }

  // What today holds, printed on the morning board before a single decision is
  // made. This is the data the reserve rule is meant to be read against.
  function forecast(run) {
    const q = run.queue;
    const out = sum(q.filter((c) => c.kind === "withdraw"), (c) => c.amount);
    return {
      borrowers: q.filter((c) => c.kind === "borrow").length,
      savers: q.filter((c) => c.kind === "save").length,
      leaving: q.filter((c) => c.kind === "withdraw").length,
      leavingAmount: out
    };
  }

  function setRates(run, save, loan) {
    if (SAVE_RATES.indexOf(save) >= 0) run.bank.saveRate = save;
    if (LOAN_RATES.indexOf(loan) >= 0) run.bank.loanRate = loan;
    return run.bank;
  }

  // What tonight would come to at the rates now on the dial, if nothing else
  // happened. Not a prediction of the day — a reading of the two dials against
  // the books as they stand, so the child can see what a cent is worth to them
  // before they choose it rather than a night later.
  function tonightAt(run, save, loan) {
    const bank = run.bank;
    const inn = nightlyOn(bank.loansOut, loan === undefined ? bank.loanRate : loan);
    const out = nightlyOn(bank.deposits, save === undefined ? bank.saveRate : save);
    return { in: inn, out: out, kept: inn - out };
  }

  function openCounter(run) {
    run.phase = "counter";
    run.at = 0;
    return current(run);
  }

  /* ── The counter ───────────────────────────────────────────────────────── */

  function current(run) {
    if (run.at >= run.queue.length) return null;
    const c = run.queue[run.at];
    return c.done ? null : c;
  }

  // Does this customer go through with it at the rate on your dial? One roll per
  // customer, taken from (seed, day, position) so a reload cannot re-roll it.
  function willing(run, c) {
    const bank = run.bank;
    if (c.kind === "withdraw") return true;
    const rng = BB.Rng.stream(run.seed, run.day * 104729 + run.at * 31 + 5);
    const roll = rng.next();
    if (c.kind === "save") return roll < DEPOSIT_CHANCE[bank.saveRate];
    return roll < ACCEPT[person(c.id).star][bank.loanRate];
  }

  // Everything the counter can come to. Returns an outcome the UI narrates; it
  // never draws anything itself.
  //
  // Only a LOAN is a decision. Savers are taken as they come and people wanting
  // their own money back are paid — the first pass made accepting a deposit a
  // third kind of question, and two counterintuitive decisions on one screen is
  // one more than an 8-year-old should have to hold.
  function serve(run, choice) {
    const c = current(run);
    if (!c) return null;
    const bank = run.bank;
    const out = { customer: c, kind: c.kind, person: person(c.id) };

    if (c.kind === "withdraw") {
      Object.assign(out, payOut(run, bank, c));
      finish(run, c);
      return out;
    }

    if (!willing(run, c)) {
      out.walked = true;
      out.why = c.kind === "save"
        ? "didn't think " + bank.saveRate + "c a night was worth it"
        : "thought " + bank.loanRate + "c a night was too dear";
      finish(run, c);
      return out;
    }

    if (c.kind === "save") {
      Object.assign(out, takeDeposit(run, bank, c));
      finish(run, c);
      return out;
    }

    // A loan, and the whole deal comes with it: what it earns a night, what it
    // earns in all, when the money comes home, and what it would leave in the
    // vault. Those five numbers ARE the decision, so they are on the card at the
    // moment the buttons appear rather than a beat later.
    out.rate = bank.loanRate;
    out.nightly = nightlyOn(c.amount, bank.loanRate);
    out.interest = interestOver(c.amount, bank.loanRate, c.nights);
    out.due = run.day + c.nights;
    out.canPay = bank.cash >= c.amount;
    out.leaves = bank.cash - c.amount;
    out.keep = reserveNeeded(run, bank);
    out.belowLine = out.leaves < out.keep;
    if (!choice) { out.asking = true; return out; }

    if (choice !== "lend" || !out.canPay) {
      bank.today.refused++;
      out.refused = true;
      finish(run, c);
      return out;
    }

    Object.assign(out, lend(run, bank, c));
    finish(run, c);
    return out;
  }

  function finish(run, c) {
    c.done = true;
    run.at++;
    if (!current(run)) run.phase = "night";
  }

  /* ── The three ways money moves ────────────────────────────────────────── */

  function takeDeposit(run, bank, c) {
    const amount = c.amount;
    const due = run.day + c.nights;
    bank.cash += amount;
    bank.deposits += amount;
    bank.savers.push({ id: c.id, amount, paid: 0, due });
    bank.today.took += amount;
    noteOn(bank, c.id).saved += amount;
    return { took: amount, nights: c.nights, due,
             costsNightly: nightlyOn(amount, bank.saveRate) };
  }

  function lend(run, bank, c) {
    bank.cash -= c.amount;
    bank.loansOut += c.amount;
    bank.loans.push({ id: c.id, star: person(c.id).star, amount: c.amount,
      due: run.day + c.nights, why: c.why });
    bank.today.lent += c.amount;
    noteOn(bank, c.id).lent++;
    return { lent: c.amount, due: run.day + c.nights,
             nightly: nightlyOn(c.amount, bank.loanRate),
             interest: interestOver(c.amount, bank.loanRate, c.nights) };
  }

  // Somebody wants their money and it has to be there. If the coins are not,
  // loans get called in early at 75c in the dollar, which is the whole reason
  // the keep-back number is printed on the morning board.
  function payOut(run, bank, c) {
    const idx = bank.savers.findIndex((s) => s.id === c.id);
    if (idx < 0) return { gone: true };
    const s = bank.savers[idx];
    const want = s.amount + s.paid;
    const res = { paidOut: want, interest: s.paid };

    if (bank.cash < want) Object.assign(res, fireSale(run, bank, want - bank.cash));
    if (bank.cash < want) {
      // Nothing left to call in. The saver goes away empty-handed, which is the
      // worst thing that can happen to a bank and is priced accordingly.
      res.short = true;
      res.paidOut = 0;
      bank.today.missed++;
      return res;
    }

    bank.savers.splice(idx, 1);
    bank.cash -= want;
    bank.deposits -= want;
    bank.today.paidOut += want;
    return res;
  }

  // Call in enough of your loans, biggest first, to raise `need`. Everything
  // about this is deliberately ugly: it happens without being asked for, it
  // takes the money at a loss, and it tells the town.
  //
  // It calls in PART of a loan rather than the whole thing. Whole loans overshot
  // wildly — a shortfall of $5 would call in a $30 loan and cost $7.50, so the
  // punishment had almost nothing to do with the mistake. Called proportionally,
  // raising $5 costs $1.65 every time, which is a number a child can connect to
  // what they just did.
  function fireSale(run, bank, need) {
    let raised = 0, lost = 0, called = 0;
    const order = bank.loans.slice().sort((a, b) => b.amount - a.amount);
    while (raised < need - 2 && order.length) {
      const l = order.shift();
      const want = cents5((need - raised) / FIRE_SALE);
      const part = Math.min(l.amount, Math.max(5, want));
      const back = cents5(part * FIRE_SALE);
      const rest = l.amount - part;
      if (rest > 0) l.amount = rest;
      else bank.loans.splice(bank.loans.indexOf(l), 1);
      bank.cash += back;
      bank.loansOut -= part;
      bank.own -= part - back;
      raised += back;
      lost += part - back;
      called++;
    }
    if (called) {
      bank.fires++;
      bank.lost += lost;
      bank.today.fire += lost;
    }
    return { fire: { called, raised, lost } };
  }

  /* ── Night ─────────────────────────────────────────────────────────────── */

  // One sum, the same shape every night: what borrowers paid you, less what you
  // paid savers, less anything that went wrong today. That is the whole of what
  // a bank earns and it is the only screen the end of the day needs.
  function night(run) {
    const bank = run.bank;
    const b = { day: run.day, save: bank.saveRate, loan: bank.loanRate,
      lentOut: bank.loansOut, held: bank.deposits,
      interestIn: 0, interestOut: 0, badDebt: bank.today.badDebt, fire: bank.today.fire,
      back: bank.today.back, bad: bank.today.bad,
      backIn: bank.today.backIn, trustBefore: bank.trust, missed: bank.today.missed };

    // 1. Borrowers pay tonight's interest, in coins, on what is still out with
    //    them. Money that is out working is the only money that earns.
    b.interestIn = nightlyOn(bank.loansOut, bank.loanRate);
    if (b.interestIn > 0) {
      bank.cash += b.interestIn;
      bank.own += b.interestIn;
      bank.earned += b.interestIn;
    }

    // 2. You pay savers tonight's interest on everything they have left with
    //    you — the coins you lent out and the coins still sitting in the vault
    //    alike. It joins their pile, which is what compounding looks like, and
    //    it is why a vault full of money you could not lend is a bill.
    for (const s of bank.savers) {
      const add = nightlyOn(s.amount + s.paid, bank.saveRate);
      if (add <= 0) continue;
      s.paid += add;
      bank.deposits += add;
      bank.own -= add;
      b.interestOut += add;
    }
    bank.paidOut += b.interestOut;
    bank.today.interestIn = b.interestIn;
    bank.today.interestOut = b.interestOut;

    // 3. The town makes up its mind, on one rule: look after people and one more
    //    of them joins; let somebody down and five walk. Trust is won by serving
    //    people rather than by avoiding mistakes, which is the shape a child who
    //    is playing well needs it to have.
    const letDown = b.missed > 0 || bank.today.fire > 0;
    const served = bank.today.took > 0 || bank.today.lent > 0 || bank.today.paidOut > 0;
    if (letDown) bank.trust = clamp(bank.trust - 5, 1, TOWNSFOLK);
    else if (served) bank.trust = clamp(bank.trust + 1, 1, TOWNSFOLK);
    b.trustAfter = bank.trust;

    b.kept = b.interestIn - b.interestOut - b.badDebt - b.fire;
    b.own = bank.own;
    b.cash = bank.cash;
    b.trust = bank.trust;
    b.deposits = bank.deposits;

    run.report = b;
    run.phase = "evening";
    run.ledger.push(b);
    return b;
  }

  // Stable per-person salt, so the same loan always resolves the same way.
  function hash(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function nextDay(run) {
    if (run.day >= run.days) { run.phase = "over"; closeUp(run); return false; }
    run.day++;
    startDay(run);
    return true;
  }

  // Closing time. Savers get every cent back and any loan still out there comes
  // back as just the money you lent. Equity does not move, which is the point:
  // what you gave up is the nights of interest, not a fine.
  function closeUp(run) {
    const bank = run.bank;
    bank.closing = { stillOut: bank.loansOut, loans: bank.loans.length,
      savers: bank.savers.length, giveBack: bank.deposits };
    bank.cash += bank.loansOut;
    bank.loansOut = 0;
    bank.loans = [];
    bank.cash -= bank.deposits;
    bank.deposits = 0;
    bank.savers = [];
  }

  /* ── Scoring ───────────────────────────────────────────────────────────── */

  const rungReached = (v, goal) => {
    let n = 0;
    for (const g of goal) if (v >= g) n++;
    return n;
  };

  function summary(run) {
    const sp = spec(run.difficulty);
    const a = run.bank;
    return {
      own: a.own, grew: a.own - START_OWN,
      rung: rungReached(a.own, sp.goal),
      goal: sp.goal, rungs: sp.rungs,
      trust: a.trust, earned: a.earned, paidOut: a.paidOut,
      badDebts: a.badDebts, lost: a.lost, fires: a.fires,
      closing: a.closing || null
    };
  }

  // A line a child can take away, picked from what actually happened rather than
  // from the score. Ordered worst-lesson-first: the thing that cost the most is
  // the thing worth saying.
  function takeaway(run) {
    const a = run.bank;
    if (a.own < START_OWN) {
      return "Your bank ended up with less than it started with. The gap between what you pay " +
        "savers and what you charge borrowers has to cover the loans that never come back.";
    }
    if (a.fires > 0) {
      return "Calling your loans in early cost you " + money(a.lost) +
        ". Keeping back what you've promised people is cheaper than any loan is worth.";
    }
    if (a.badDebts > a.earned / 2) {
      return "You lost " + money(a.badDebts) + " to people who never paid you back — nearly as " +
        "much as you earned. Lending to everybody is not the same as being kind.";
    }
    if (a.trust >= TOWNSFOLK - 4) {
      return "Nearly the whole town banks with you. That is what pays for everything else: " +
        "the more coins people leave with you, the more you have to lend out.";
    }
    return "You made " + money(a.own - START_OWN) + " out of " + money(START_OWN) +
      ". Every cent of it came from the gap between what you paid savers and what borrowers paid you.";
  }

  // For the chart: your own money at the end of every day, and beside it what
  // the savers' pile was doing. The gap between the two is the story — you grew
  // your own pile by looking after somebody else's.
  function series(run) {
    const own = [START_OWN], deposits = [0];
    for (const row of run.ledger) { own.push(row.own); deposits.push(row.deposits); }
    return { own, deposits };
  }

  // What each pair of rates actually came to, gathered from the nights it was
  // used. The morning board reads this back, and it is the difference between
  // picking a tile and making a decision.
  function rateHistory(run) {
    const rows = {};
    for (const r of run.ledger) {
      const key = r.save + "/" + r.loan;
      const row = rows[key] || (rows[key] = { save: r.save, loan: r.loan, nights: 0, kept: 0 });
      row.nights++;
      row.kept += r.kept;
    }
    return Object.keys(rows).map((k) => rows[k]).sort((a, b) => b.kept - a.kept);
  }

  /* ── Saving ────────────────────────────────────────────────────────────── */

  // The run is already plain data, so a snapshot is a deep copy rather than a
  // hand-listed set of fields — the shape that goes stale every time a field is
  // added. What restore() does instead is validate hard on the way back in.
  function snapshot(run) {
    if (!run || run.phase === "over") return null;
    try { return JSON.parse(JSON.stringify(run)); } catch (e) { return null; }
  }

  function restore(snap) {
    try {
      if (!snap || !LEVELS[snap.difficulty]) return null;
      const sp = spec(snap.difficulty);
      if (!Number.isInteger(snap.day) || snap.day < 1 || snap.day > sp.days) return null;
      const b = snap.bank;
      if (!b || !Array.isArray(b.savers) || !Array.isArray(b.loans)) return null;
      if (check(b)) return null;
      if (SAVE_RATES.indexOf(b.saveRate) < 0 || LOAN_RATES.indexOf(b.loanRate) < 0) return null;
      const run = JSON.parse(JSON.stringify(snap));
      if (!Array.isArray(run.queue)) run.queue = [];
      if (!Array.isArray(run.ledger)) run.ledger = [];
      if (!run.bank.record) run.bank.record = {};
      return run;
    } catch (e) { return null; }
  }

  return {
    // money
    cents5, money, price, clamp,
    // constants
    START_OWN, START_TRUST, TOWNSFOLK, FIRE_SALE, RESERVE_NIGHTS,
    SAVE_RATES, LOAN_RATES, DEFAULT_RATE, RECOVERY, ACCEPT, DEPOSIT_CHANCE,
    TOWN, LEVELS, DEPOSITS, BORROWS, OPENING,
    spec, person, heaps, reserveNeeded, dueSoon, spare, check,
    nightlyOn, interestOver, tonightAt, forecast,
    // the run
    newRun, startDay, setRates, openCounter, current, serve, night, nextDay,
    // scoring
    rungReached, summary, takeaway, series, rateHistory,
    // saving
    snapshot, restore
  };
})();
