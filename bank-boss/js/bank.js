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
  // A loan of $1 for n nights at r cents a night comes back as (1 + r*n/100), or
  // not at all. Divide the loss by the nights and it is a rate like any other:
  //
  //   what a star is really worth, per dollar per night = r - default*100/n
  //
  // At n = 4.5 nights the expected loss works out at 0.9c, 1.6c and 10.7c a
  // night. Set against the middle 8c loan rate and 2c paid to savers that is
  // +5.1c, +4.4c and -4.7c — so the ladder is legible and, more importantly, NO
  // rate on the dial makes a one-star loan worth taking: at the dearest 10c it
  // is still -2.7c a night. Dodgy Dave is not a gamble that pays if you charge
  // enough, and the harness asserts exactly that.
  //
  // Two stars went from 18% to 14%, and that is a straight softening rather than
  // a discovery: it buys four points off the share of well-played runs that
  // finish behind, and it costs the sharpness of the gap between two stars and
  // three. It was worth it because the floor is what a child feels and the
  // difference between a 0.9c risk and a 1.6c one is not. The decision the game
  // actually asks — lend to two and three stars, never to one — is untouched.
  //
  // Two things were tried first and MEASURED WORSE, both worth not repeating.
  // Splitting the same expected loss into more frequent, smaller failures made
  // the spread wider, not narrower, because a loan that goes wrong forfeits all
  // its INTEREST as well: raising how often one goes wrong can never be
  // mean-preserving however far the recovery rises with it. Paying back a share
  // of what is owed rather than of the principal fixes that term, and still came
  // out behind on the middle.
  const DEFAULT_RATE = { 3: 0.08, 2: 0.14, 1: 0.48 };

  // What comes back when a loan goes wrong. Somebody reliable who hits trouble
  // pays back what they can; somebody who was never going to pay you simply
  // does not. Two things were bought with this, and the second is the important
  // one: "Ivy could only pay back half" is a better beat at the counter than a
  // coin landing badly, AND halving the size of a bad debt while doubling how
  // often one happens leaves the average untouched and cuts the swing by more
  // than half. Measured, it took a well-played run's worst tenth from -$36 to
  // roughly break-even without moving the middle at all.
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

  // Who leaves money with you at all, by what you pay them. A saver who likes
  // neither bank's rate keeps it under the mattress, which is the honest answer
  // to "why does a bank pay you anything?".
  const DEPOSIT_CHANCE = { 1: 0.35, 2: 0.70, 3: 0.92 };

  const TOWNSFOLK = 20;                 // how many people there are to win over

  /* ── Amounts ───────────────────────────────────────────────────────────── */

  // A deposit is one person's savings; a loan is several people's savings lent
  // to one of them, so the two tables are a different size on purpose. Nan's $25
  // and Postie Pete's $30 are what Mo's $60 van repair is actually made of, and
  // the vault animation shows exactly that.
  //
  // Loans are two thirds the size they first were, and MORE of the queue wants
  // to borrow, and the two changes only work together. Shrinking loans on their
  // own was tried and measured worse: loans arrive at a rate the queue sets, so
  // making them smaller without sending more borrowers just shrinks the book and
  // the earnings with it.
  //
  // What the pair buys is the thing a real bank has and a child's bank did not:
  // ENOUGH LOANS FOR THE AVERAGE TO WORK. At seven loans a run, one bad debt is
  // a seventh of the book and the run is decided by whether Mo's van repair went
  // wrong; the worst tenth of well-played runs lost $67 to bad debts against $18
  // in the middle. At ten loans the same expected loss rate lands far more
  // evenly — measured, the worst tenth went from $25.15 to $43.00 and the share
  // of good runs finishing below where they started fell from 27% to 20%,
  // while the median did not move at all. Spreading your money over more
  // borrowers IS the lesson, so the game had to be big enough to contain it.
  // Deposits went UP a quarter when loans came down a third, and that pairing is
  // deliberate too. Shrinking the loans on its own shrank the whole balance
  // sheet, and a smaller balance sheet quietly forgives every mistake — a bank
  // that took every deposit and lent to nobody went from losing $59 to losing
  // $40, which is the "money asleep costs you" lesson going soft. Bigger
  // deposits against smaller loans keeps the book the size it was AND spreads it
  // over more borrowers, which is the whole point.
  const DEPOSITS = [2500, 3000, 4000, 5000, 6500, 8500];
  const BORROWS = [2000, 2500, 3500, 4000, 5000, 6500];

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
  // bank. It decides who walks up to your counter instead of the rival's, and
  // how much they are willing to leave with you. Four to start — a bank nobody
  // has heard of — and it climbs by one on every day you look after people.
  const START_TRUST = 6;

  // Calling your loans in early. Nobody hands a lender back the full amount for
  // the privilege of paying early, so you get 75c in the dollar and the missing
  // 25c comes straight off your own money. It is the only real punishment in the
  // game, and it exists so that "keep some coins back" is a rule with teeth.
  //
  // It was 60c, and 60c was a death spiral rather than a lesson: one fire sale
  // cost enough to force the next one, and a run that wobbled once never
  // recovered. A punishment a child cannot climb back out of teaches nothing
  // except that the game is unfair.
  const FIRE_SALE = 0.75;

  // The keep-back line: a quarter of the savers' money stays in the vault.
  //
  // It started as a maturity ladder — what falls due in the next night or two,
  // plus a slice for a surprise — and that was both harder to explain and worse
  // to play. It came out around 40% of the book, which capped how much could
  // ever be lent at about half, and half a vault doing nothing cannot pay for
  // itself. A flat quarter is one sentence, one line on the vault picture, and
  // it leaves room to actually run a bank.
  const RESERVE = 0.25;

  const LEVELS = {
    easy: {
      // Same daily rhythm as Normal, just fewer days. It used to send a smaller
      // queue as well, which made Easy the HARDER setting to get a rung on: half
      // the business a day means half the loans, and half the loans means one
      // bad debt swings the whole run. Fewer days is the only thing that should
      // make a short game short.
      days: 8, queue: [6, 8], surprise: 0.12, showStars: true,
      goal: [6200, 7000, 7800, 8600],
      rungs: ["🪙 a money box", "💼 a proper cash desk", "🏪 a shop on the corner", "🏛️ a real bank"]
    },
    normal: {
      days: 12, queue: [6, 8], surprise: 0.22, showStars: true,
      goal: [6300, 8000, 10000, 11500],
      rungs: ["🪙 a money box", "💼 a proper cash desk", "🏪 a shop on the corner", "🏛️ a real bank"]
    },
    // Same money, but you are not told who is reliable until you have dealt with
    // them. The stars come out one person at a time, and remembering who burnt
    // you is the whole difficulty. Same dial as Lemonade Stand hiding the till
    // total: nothing about the model changes, only what you are shown.
    tricky: {
      days: 12, queue: [6, 8], surprise: 0.3, showStars: false,
      goal: [6300, 8000, 10000, 11500],
      rungs: ["🪙 a money box", "💼 a proper cash desk", "🏪 a shop on the corner", "🏛️ a real bank"]
    }
  };

  const spec = (d) => LEVELS[d] || LEVELS.normal;

  /* ── A bank ────────────────────────────────────────────────────────────── */

  function newBank(name, emoji, who) {
    return {
      name, emoji, who,                 // who: "human" | "robot"
      cash: START_OWN,                  // coins actually in the vault
      loansOut: 0,                      // coins out with borrowers, at face value
      deposits: 0,                      // what you owe savers, interest included
      own: START_OWN,                   // cash + loansOut - deposits
      saveRate: 2,
      loanRate: 8,
      savers: [],                       // {id, amount, paid, due}
      loans: [],                        // {id, star, amount, repay, due, why}
      trust: START_TRUST,
      known: {},                        // people you have lent to, for Tricky
      panic: 0,                         // nights of word-got-around after a fire sale
      fires: 0,                         // how many times you had to call loans in
      badDebts: 0, earned: 0, paidOut: 0, lost: 0
    };
  }

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

  // The three heaps, plus the number underneath them. Everything the vault
  // picture draws comes from here so the picture and the model cannot disagree.
  function heaps(bank) {
    return {
      owed: bank.deposits,        // 🟦 savers' coins — you owe every one back
      out: bank.loansOut,         // 🟧 out on loan — not in the room right now
      own: bank.own,              // 🟩 yours
      cash: bank.cash             // what is actually in the vault
    };
  }

  // Money falling due out of the vault in the next couple of nights, plus a
  // slice for a surprise. Drawn on the vault as a line you should not lend below.
  function reserveNeeded(bank) {
    return cents5(bank.deposits * RESERVE);
  }

  const spare = (bank) => bank.cash - reserveNeeded(bank);

  // What a loan will come back as. Simple interest, stated in full the moment it
  // is granted — one number a child can hold on to, rather than a rate that has
  // to be re-multiplied every night. Savings compound; loans are quoted.
  const repayFor = (amount, rate, nights) => cents5(amount + (amount * rate * nights) / 100);

  // What the bank pays a saver tonight. Compounds, because "it grows faster the
  // longer it sits" is the half of interest that a quoted number cannot show.
  const interestOn = (held, rate) => cents5((held * rate) / 100);

  /* ── Starting a run ────────────────────────────────────────────────────── */

  // Three people already bank with you on day one. This is not a leg-up, it is
  // what makes the first screen mean anything: an empty vault has nothing to
  // show, and the whole game is a picture of whose coins are in the vault.
  //
  // It is also what stops the opening being cash-starved. Measured without it,
  // a third of the borrowers on the first few days were turned away for the
  // dullest possible reason — the coins were not there yet — and the run spent
  // half its length climbing out of a hole rather than being played.
  const OPENING = [["nan", 2000, 4], ["pos", 2500, 6], ["lib", 1500, 8]];

  function openingBook(bank) {
    for (const [id, amount, due] of OPENING) {
      bank.savers.push({ id, amount, paid: 0, due });
      bank.cash += amount;
      bank.deposits += amount;
      bank.known[id] = "saver";
    }
    return bank;
  }

  function newRun(difficulty, seed, mode, names) {
    const sp = spec(difficulty);
    const two = mode === "duo";
    const n = names || {};
    return {
      difficulty, seed, mode: two ? "duo" : "solo",
      days: sp.days, day: 1, phase: "rates",
      banks: [
        openingBook(newBank(n.a || (two ? "Player 1" : "Your bank"), "🏦", "human")),
        openingBook(newBank(n.b || (two ? "Player 2" : "Robo Bank"),
          two ? "🏦" : "🤖", two ? "human" : "robot"))
      ],
      robotLevel: "medium",
      queue: [], at: 0,
      report: null,
      ledger: []
    };
  }

  const you = (run) => run.banks[0];
  const other = (run, bank) => (bank === run.banks[0] ? run.banks[1] : run.banks[0]);

  /* ── The day's queue ───────────────────────────────────────────────────── */

  // Generated once, at the top of the day, from (seed, day) — so a resumed run
  // meets exactly the same people in the same order.
  //
  // Surprise withdrawals come first because they have to be drawn from people
  // who actually hold a deposit somewhere, and nobody may be two customers in
  // one day.
  function startDay(run) {
    const sp = spec(run.difficulty);
    const rng = BB.Rng.stream(run.seed, run.day * 7919 + 13);
    const left = run.days - run.day;          // nights still to run after tonight
    const used = {};
    const queue = [];

    // Word got around after a fire sale: everybody who can, comes for their
    // money. That is what a bank run is, and it is a consequence rather than a
    // separate mechanic.
    for (const bank of run.banks) {
      const wobble = bank.panic > 0;
      const holders = bank.savers.filter((s) => s.due > run.day && !used[s.id]);
      const want = wobble ? Math.min(1, holders.length) : (rng.chance(sp.surprise) ? 1 : 0);
      for (let i = 0; i < want && holders.length; i++) {
        const s = holders.splice(rng.int(holders.length), 1)[0];
        used[s.id] = true;
        const held = s.amount + s.paid;
        // PART of what they have, not all of it. Somebody clearing out their
        // whole account at random was bigger than the keep-back line on its own,
        // so a bank following the rule to the letter still had to call its loans
        // in on a third of runs — a rule that does not work when obeyed is worse
        // than no rule.
        const want = Math.round((held * (0.3 + rng.next() * 0.5)) / 50) * 50;
        queue.push({ kind: "withdraw", id: s.id, bankAt: run.banks.indexOf(bank),
          amount: clamp(want, 500, held), panic: wobble });
      }
    }

    const size = rng.between(sp.queue[0], sp.queue[1]);
    const trustBoth = (run.banks[0].trust + run.banks[1].trust) / (2 * TOWNSFOLK);
    while (queue.length < size) {
      const free = TOWN.filter((p) => !used[p.id]);
      if (!free.length) break;
      const p = free[rng.int(free.length)];
      used[p.id] = true;

      // A borrower whose loan would fall due after the last day never turns up:
      // the run has to end with the books straight, or the last screen is a
      // muddle about money that never came back. One night is still a loan, so
      // only the very last day is loan-free — at `left >= 2` the last two days
      // were savers-only and the run limped to a stop.
      const canBorrow = left >= 1;
      // Seven in ten of the town's business is somebody wanting to borrow. Read
      // on its own that looks like a thumb on the scale; it is half of the
      // diversification fix above, and the deposit side does not suffer for it
      // because a deposit is nearly twice the size of a loan.
      const kind = canBorrow && rng.chance(0.7) ? "borrow" : "save";

      if (kind === "save") {
        const nights = Math.min(rng.between(5, 9), Math.max(1, left));
        queue.push({ kind: "save", id: p.id,
          amount: scaled(rng.pick(DEPOSITS), trustBoth), nights });
      } else {
        const nights = Math.min(rng.between(3, 6), left);
        queue.push({ kind: "borrow", id: p.id,
          amount: scaled(rng.pick(BORROWS), trustBoth), nights,
          why: rng.pick(REASONS) });
      }
    }

    run.queue = queue;
    run.at = 0;
    run.report = null;
    run.phase = "rates";
    for (const b of run.banks) {
      b.today = { took: 0, lent: 0, paidBack: 0, badDebt: 0, interestOut: 0,
        interestIn: 0, refused: 0, fire: 0, missed: 0, joined: 0, turnedAway: 0 };
    }
    return run;
  }

  // Business grows with the town's confidence. Without this the deposit base
  // reaches its steady state in about five days and the second half of the run
  // is the first half again — which is exactly the bug Lemonade Stand's eighth
  // pass had to go back and fix.
  function scaled(base, trustFrac) {
    return Math.round((base * (0.45 + 1.1 * trustFrac)) / 50) * 50;
  }

  function setRates(run, which, save, loan) {
    const bank = run.banks[which];
    if (SAVE_RATES.indexOf(save) >= 0) bank.saveRate = save;
    if (LOAN_RATES.indexOf(loan) >= 0) bank.loanRate = loan;
    return bank;
  }

  function openCounter(run) {
    run.phase = "counter";
    run.at = 0;
    return current(run);
  }

  /* ── The counter ───────────────────────────────────────────────────────── */

  // Who is standing there, which counter they have chosen, and whether anybody
  // has to decide anything. `stage` is 0 at the first bank they tried and 1 once
  // they have been turned down and walked across the street.
  function current(run) {
    if (run.at >= run.queue.length) return null;
    const c = run.queue[run.at];
    if (c.done) return null;
    if (c.at === undefined) decide(run, c);
    return c;
  }

  // Which counter this customer walks up to. Savers go where the money is best,
  // borrowers where it is cheapest, and both of them lean towards the bank they
  // already trust.
  function decide(run, c) {
    const rng = BB.Rng.stream(run.seed, run.day * 104729 + run.at * 31 + 5);
    c.stage = 0;
    if (c.kind === "withdraw") { c.at = c.bankAt; return; }

    const p = person(c.id);
    // Squared, so a better rate wins more of the town than it strictly deserves
    // — but a SHARE of it, never all of it. Winner-takes-all would turn the two
    // dials into a cliff: one cent better and you get everybody, one cent worse
    // and your counter is empty all game. A fall-off teaches; a cliff just
    // removes a button.
    const appeal = run.banks.map((b) => {
      const tf = b.trust / TOWNSFOLK;
      const like = c.kind === "save" ? DEPOSIT_CHANCE[b.saveRate] : ACCEPT[p.star][b.loanRate];
      return like * like * (0.45 + 0.55 * tf);
    });
    const total = appeal[0] + appeal[1];
    const first = total <= 0 ? rng.int(2) : (rng.next() < appeal[0] / total ? 0 : 1);
    c.at = first;
    c.order = [first, 1 - first];
    c.roll = rng.next();
    c.repayRoll = rng.next();
  }

  // Does this customer actually go through with it at the bank they are standing
  // in front of? One roll per customer, reused if they cross the street, because
  // somebody who thinks 8c is too dear thinks so at both counters.
  function willing(run, c) {
    const b = run.banks[c.at];
    if (c.kind === "withdraw") return true;
    if (c.kind === "save") return c.roll < DEPOSIT_CHANCE[b.saveRate];
    return c.roll < ACCEPT[person(c.id).star][b.loanRate];
  }

  // Everything that can happen when somebody reaches the front of the queue.
  // Returns an outcome the UI narrates; it never draws anything itself.
  function serve(run, choice) {
    const c = current(run);
    if (!c) return null;
    const bank = run.banks[c.at];
    const out = { customer: c, bank: c.at, kind: c.kind, person: person(c.id) };

    if (c.kind === "withdraw") {
      Object.assign(out, payOut(run, bank, c));
      finish(run, c);
      return out;
    }

    if (!willing(run, c)) {
      // Turned their nose up at the rate. A saver goes home with it; a borrower
      // tries the other counter, because a cheaper bank is worth walking to.
      out.walked = true;
      if (c.kind === "borrow" && c.stage === 0) {
        c.stage = 1;
        c.at = c.order[1];
        out.crossed = run.banks[c.at].name;
        if (willing(run, c)) { out.crossed = null; out.walked = false; return askOrDecide(run, c, out); }
      }
      finish(run, c);
      return out;
    }

    if (c.kind === "save") return askSaver(run, c, out, choice);

    return askOrDecide(run, c, out, choice);
  }

  // A saver is a decision too, and it is the one that surprises people. Money
  // you cannot lend still costs you every night, so a vault that is already full
  // is a reason to say "no thank you" — which is a thing real banks do and a
  // thing no child expects. Turning somebody away costs a little trust, so it is
  // a trade rather than a free out.
  function askSaver(run, c, out, choice) {
    const bank = run.banks[c.at];
    out.wouldTake = c.amount;
    out.nights = c.nights;
    if (bank.who === "human" && !choice) { out.asking = true; return out; }
    const yes = choice ? choice === "take" : BB.Rival.takeDeposit(run, bank, c);
    if (!yes) {
      // The cost lands once, at the end of the day, however many people you
      // turned away. Charged per person it was brutal: a bank sensibly refusing
      // two savers a day lost trust faster than serving people could win it
      // back, so the one move that protects you from the idle-money drag quietly
      // shrank your business instead.
      bank.today.turnedAway++;
      out.turnedAway = true;
      finish(run, c);
      return out;
    }
    Object.assign(out, takeDeposit(run, bank, c));
    finish(run, c);
    return out;
  }

  // A loan is the only decision at the counter. A human bank is asked; a robot
  // makes its mind up on the spot.
  function askOrDecide(run, c, out, choice) {
    const bank = run.banks[c.at];
    out.bank = c.at;
    out.rate = bank.loanRate;
    out.repay = repayFor(c.amount, bank.loanRate, c.nights);
    out.due = run.day + c.nights;

    // You cannot lend coins you have not got. Checked here rather than trusted
    // to the button, because a "lend" that cannot complete would leave the same
    // customer at the front of the queue for ever.
    out.canPay = bank.cash >= c.amount;
    if (bank.who === "human" && !choice) { out.asking = true; return out; }
    const yes = out.canPay && (choice ? choice === "lend" : BB.Rival.lend(run, bank, c));

    if (!yes) {
      bank.today.refused++;
      out.refused = true;
      if (c.stage === 0) {
        // Turned down here, so they try the other counter. Refusing a good
        // borrower and watching the rival take them is the point of this.
        c.stage = 1;
        c.at = c.order[1];
        if (willing(run, c)) { out.sentOn = run.banks[c.at].name; return out; }
      }
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
    const next = current(run);
    if (!next) run.phase = "night";
  }

  // Continue a customer who was turned down at the first counter and is now
  // standing at the second one. Only ever needed in two-player.
  const pendingElsewhere = (run) => {
    const c = current(run);
    return c && c.stage === 1 && !c.done ? c : null;
  };

  /* ── The four ways money moves ─────────────────────────────────────────── */

  function takeDeposit(run, bank, c) {
    const amount = c.amount;
    bank.cash += amount;
    bank.deposits += amount;
    bank.savers.push({ id: c.id, amount, paid: 0, due: run.day + c.nights });
    bank.today.took += amount;
    if (!bank.known[c.id]) { bank.known[c.id] = "saver"; bank.today.joined++; }
    return { took: amount, nights: c.nights, due: run.day + c.nights };
  }

  function lend(run, bank, c) {
    const repay = repayFor(c.amount, bank.loanRate, c.nights);
    bank.cash -= c.amount;
    bank.loansOut += c.amount;
    bank.loans.push({ id: c.id, star: person(c.id).star, amount: c.amount,
      repay, due: run.day + c.nights, why: c.why });
    bank.today.lent += c.amount;
    bank.known[c.id] = "borrower";     // Tricky reveals a star once you have dealt with them
    return { lent: c.amount, repay, due: run.day + c.nights,
      belowLine: bank.cash < reserveNeeded(bank) };
  }

  // Somebody wants their money and you must find it. If the coins are not there
  // you have to call loans in early at 60c in the dollar, which is the whole
  // reason the keep-back line is drawn on the vault.
  function payOut(run, bank, c) {
    const idx = bank.savers.findIndex((s) => s.id === c.id);
    if (idx < 0) return { gone: true };
    const s = bank.savers[idx];
    const held = s.amount + s.paid;
    const want = clamp(c.amount, 0, held);
    const res = { paidOut: want, held, leaves: want >= held };

    if (bank.cash < want) Object.assign(res, fireSale(run, bank, want - bank.cash));
    if (bank.cash < want) { res.short = true; res.paidOut = 0; return res; }

    // Their interest comes off first, then their savings — which is both what a
    // real account does and the version a child can follow, because the number
    // that shrinks is the one they watched grow.
    const fromPaid = Math.min(s.paid, want);
    s.paid -= fromPaid;
    s.amount -= want - fromPaid;
    if (s.amount + s.paid <= 0) bank.savers.splice(idx, 1);
    bank.cash -= want;
    bank.deposits -= want;
    return res;
  }

  // Call in enough of your loans, biggest first, to raise `need`. Everything
  // about this is deliberately ugly: it happens without being asked for, it
  // takes the money at a loss, and it tells the town.
  //
  // It calls in PART of a loan rather than the whole thing, and that is not a
  // detail. Whole loans overshot wildly — a shortfall of $5 would call in a $30
  // loan and cost $7.50, so the punishment had almost nothing to do with the
  // mistake. Called proportionally, raising $5 costs $1.65 every time, which is
  // a number a child can connect to what they just did.
  function fireSale(run, bank, need) {
    let raised = 0, lost = 0, called = 0;
    const order = bank.loans.slice().sort((a, b) => b.amount - a.amount);
    while (raised < need - 2 && order.length) {
      const l = order.shift();
      const want = cents5((need - raised) / FIRE_SALE);
      const part = Math.min(l.amount, Math.max(5, want));
      const back = cents5(part * FIRE_SALE);
      const rest = l.amount - part;
      // The rest of the loan carries on, with its repayment cut in the same
      // proportion — one number, so the loan card cannot start lying.
      const newRepay = rest > 0 ? cents5((l.repay * rest) / l.amount) : 0;
      if (rest > 0) { l.amount = rest; l.repay = newRepay; }
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
      bank.panic = 1;
      bank.trust = clamp(bank.trust - 6, 1, TOWNSFOLK);
      bank.lost += lost;
      bank.today.fire += lost;
    }
    return { fire: { called, raised, lost } };
  }

  /* ── Night ─────────────────────────────────────────────────────────────── */

  // Interest both ways, loans settling, savers cashing out, and then the town
  // makes up its mind about you. One function, so a resumed run and a live one
  // take the same path.
  function night(run) {
    const rep = { day: run.day, banks: [] };

    for (const bank of run.banks) {
      const b = { name: bank.name, interestOut: 0, interestIn: 0, back: [], bad: [],
        matured: [], fire: null, trustBefore: bank.trust, missed: 0 };

      // 1. Pay the savers. This is money leaving your own pile and joining
      //    theirs, which is exactly what it looks like on the screen.
      for (const s of bank.savers) {
        const add = interestOn(s.amount + s.paid, bank.saveRate);
        if (add <= 0) continue;
        s.paid += add;
        bank.deposits += add;
        bank.own -= add;
        b.interestOut += add;
      }
      bank.paidOut += b.interestOut;
      bank.today.interestOut += b.interestOut;

      // 2. Loans falling due today. Whether they pay is a roll made once, when
      //    the loan was granted — so it cannot be re-rolled by a save and reload.
      for (const l of bank.loans.slice()) {
        if (l.due > run.day) continue;
        const rng = BB.Rng.stream(run.seed, hash(l.id) + l.due * 977 + l.amount);
        const paid = rng.next() >= DEFAULT_RATE[l.star];
        bank.loans.splice(bank.loans.indexOf(l), 1);
        bank.loansOut -= l.amount;
        if (paid) {
          bank.cash += l.repay;
          bank.own += l.repay - l.amount;
          bank.earned += l.repay - l.amount;
          bank.today.interestIn += l.repay - l.amount;
          b.interestIn += l.repay - l.amount;
          b.back.push({ id: l.id, repay: l.repay, profit: l.repay - l.amount });
        } else {
          const back = cents5(l.amount * RECOVERY[l.star]);
          const lost = l.amount - back;
          bank.cash += back;
          bank.own -= lost;
          bank.badDebts += lost;
          bank.today.badDebt += lost;
          b.bad.push({ id: l.id, amount: l.amount, back, lost, star: l.star });
        }
      }

      // 3. Savers whose nights are up want their money.
      for (const s of bank.savers.slice()) {
        if (s.due > run.day) continue;
        const owed = s.amount + s.paid;
        if (bank.cash < owed) {
          const f = fireSale(run, bank, owed - bank.cash);
          if (f.fire && f.fire.called) b.fire = f.fire;
        }
        if (bank.cash < owed) { b.missed++; bank.today.missed++; continue; }
        bank.savers.splice(bank.savers.indexOf(s), 1);
        bank.cash -= owed;
        bank.deposits -= owed;
        b.matured.push({ id: s.id, owed, interest: s.paid });
      }

      // 4. The town makes up its mind. Trust is won by serving people, not by
      //    avoiding mistakes — the same shape as Lemonade Stand's regulars, and
      //    for the same reason: a stat that only ever goes down for a child who
      //    is playing well is a stat that teaches the wrong thing.
      const served = bank.today.took > 0 || bank.today.lent > 0 || b.matured.length > 0;
      if (b.missed > 0) bank.trust = clamp(bank.trust - 4, 1, TOWNSFOLK);
      else if (bank.today.turnedAway > 0) bank.trust = clamp(bank.trust - 1, 1, TOWNSFOLK);
      else if (served && !b.fire) bank.trust = clamp(bank.trust + 1, 1, TOWNSFOLK);
      b.turnedAway = bank.today.turnedAway;
      if (bank.panic > 0) bank.panic--;

      b.trustAfter = bank.trust;
      b.own = bank.own;
      b.heaps = heaps(bank);
      rep.banks.push(b);
    }

    run.report = rep;
    run.phase = "evening";
    run.ledger.push({ day: run.day, own: run.banks.map((b) => b.own),
      trust: run.banks.map((b) => b.trust), deposits: run.banks.map((b) => b.deposits) });
    return rep;
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

  // Closing time. Savers get every cent back, and any loan still out there comes
  // back as just the money you lent — the interest you would have earned needed
  // nights you no longer have. Equity does not move, which is the point: the
  // lesson is about the interest you forwent, not a fine.
  function closeUp(run) {
    for (const bank of run.banks) {
      bank.closing = { stillOut: bank.loansOut, loans: bank.loans.length,
        savers: bank.savers.length, giveBack: bank.deposits };
      bank.cash += bank.loansOut;
      bank.loansOut = 0;
      bank.loans = [];
      bank.cash -= bank.deposits;
      bank.deposits = 0;
      bank.savers = [];
    }
  }

  /* ── Scoring ───────────────────────────────────────────────────────────── */

  const rungReached = (v, goal) => {
    let n = 0;
    for (const g of goal) if (v >= g) n++;
    return n;
  };

  function summary(run) {
    const sp = spec(run.difficulty);
    const a = run.banks[0], b = run.banks[1];
    return {
      own: a.own, rival: b.own,
      rung: rungReached(a.own, sp.goal),
      goal: sp.goal, rungs: sp.rungs,
      trust: a.trust, earned: a.earned, paidOut: a.paidOut,
      badDebts: a.badDebts, lost: a.lost, fires: a.fires,
      won: a.own > b.own,
      closing: a.closing || null
    };
  }

  // A line a child can take away, picked from what actually happened rather than
  // from the score. Ordered worst-lesson-first: the thing that cost the most is
  // the thing worth saying.
  function takeaway(run) {
    const a = run.banks[0];
    if (a.own < START_OWN) {
      return "Your bank ended up with less than it started with. The gap between what you pay " +
        "savers and what you charge borrowers has to cover the loans that never come back.";
    }
    if (a.fires > 0) {
      return "Calling your loans in early cost you " + money(a.lost) +
        ". Keeping enough coins in the vault is cheaper than any loan is worth.";
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
  // the deposits were doing. The gap between the two is the story — you grew
  // your own pile by looking after somebody else's.
  function series(run) {
    const own = [START_OWN], deposits = [0], trust = [START_TRUST];
    for (const row of run.ledger) {
      own.push(row.own[0]);
      deposits.push(row.deposits[0]);
      trust.push(row.trust[0]);
    }
    return { own, deposits, trust };
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
      if (!Array.isArray(snap.banks) || snap.banks.length !== 2) return null;
      for (const b of snap.banks) {
        if (!Array.isArray(b.savers) || !Array.isArray(b.loans)) return null;
        if (check(b)) return null;
        if (SAVE_RATES.indexOf(b.saveRate) < 0 || LOAN_RATES.indexOf(b.loanRate) < 0) return null;
      }
      const run = JSON.parse(JSON.stringify(snap));
      if (!Array.isArray(run.queue)) run.queue = [];
      return run;
    } catch (e) { return null; }
  }

  return {
    // money
    cents5, money, price, clamp,
    // constants
    START_OWN, START_TRUST, TOWNSFOLK, FIRE_SALE, RESERVE,
    SAVE_RATES, LOAN_RATES, DEFAULT_RATE, RECOVERY, ACCEPT, DEPOSIT_CHANCE,
    TOWN, LEVELS, DEPOSITS, BORROWS, OPENING,
    spec, person, heaps, reserveNeeded, spare, repayFor, interestOn, check,
    // the run
    newRun, startDay, setRates, openCounter, current, serve, pendingElsewhere,
    night, nextDay, you, other,
    // scoring
    rungReached, summary, takeaway, series,
    // saving
    snapshot, restore
  };
})();
