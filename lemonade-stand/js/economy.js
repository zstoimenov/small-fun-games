/* Lemonade Stand — the whole economy, and nothing else.                        */
/*                                                                              */
/* Pure: no DOM, no clock, no Math.random, no reading of anything outside the    */
/* arguments it is handed. That is what lets tools/check.js load this file into  */
/* plain node and play tens of thousands of days to find out whether the game    */
/* teaches what it claims to. The balancing here is measured, not guessed —      */
/* see the sweep at the bottom of that harness.                                  */
/*                                                                              */
/* THE MONEY RULE, which everything else bends around:                          */
/*                                                                              */
/*   Every amount is a whole number of CENTS, held in a JS integer. Every amount */
/*   a child ever sees is also a multiple of 5c, because Australia has no 1c or  */
/*   2c coins. Floats are allowed in the demand model — customers aren't money — */
/*   but the instant a number becomes money it passes through cents5() and stays */
/*   an integer for ever after. money() is display only and is called nowhere    */
/*   but the edge of the UI.                                                     */
"use strict";
window.LS = window.LS || {};

LS.Economy = (function () {
  /* ── Money ─────────────────────────────────────────────────────────────── */

  // Round to the nearest 5c, half up. The ONLY rounding function in the game.
  // Written as integer arithmetic on purpose: (c/5) would put a float on the
  // stack and floats are exactly what this game must not have.
  const cents5 = (c) => Math.floor((c + 2) / 5) * 5;

  // Display only. Never feed the result of this back into a calculation.
  function money(c) {
    const neg = c < 0;
    const v = Math.abs(c);
    const s = v % 100 === 0 ? "$" + v / 100 + ".00" : "$" + (v / 100).toFixed(2);
    return neg ? "-" + s : s;
  }

  // The small-change voice: 65c reads better than $0.65 on a button.
  const price = (c) => (c < 100 ? c + "c" : money(c));

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /* ── Constants ─────────────────────────────────────────────────────────── */

  // $3.00. Deliberately NOT enough for the 15-cup pack, which costs $3.60-$7.20
  // depending on the day — at $10 you could buy the big pack twice over on day
  // one and the bank was decoration. Now day one is a real decision: five cups
  // out of your own pocket, or borrow $5 and fill the stall on a hot forecast.
  // The 5-cup pack stays affordable at every lemon price, so borrowing is a
  // choice and never a requirement.
  const START_CASH = 300;
  // 52 cups. This number's whole job is to sit far enough above the day you
  // expect that filling it is visibly the wrong move — the gap between the two
  // IS the "don't make more than you can sell" lesson, and it has to be paid
  // for in lemons: filling a 52-cup stall costs about $19, against a day that
  // usually asks for 20.
  //
  // It went up with MAX_REGULARS, and it had to. Regulars are demand, so raising
  // the ceiling on them raises what an ordinary day asks for — and measured at a
  // 40-cup stall with 14 regulars, "fill it every morning" caught right up with
  // reading the forecast ($94 against $96) and the morning stopped being a
  // question again. Held at 52 the gap comes back: filling the stall bins 36% of
  // what it buys and finishes $28 behind stocking to the forecast. Raising the
  // two together is what keeps the lesson while letting the business grow.
  const STALL_LIMIT = 52;

  /* ── Regulars ──────────────────────────────────────────────────────────── */

  // The business growing, as a number of people rather than a hidden score.
  //
  // This used to be `rep`, a 0-100 dial that multiplied demand by 0.73…1.27 and
  // appeared nowhere on screen. Two things were wrong with it. It was invisible,
  // so the stall could not be felt to grow; and measured over 600 fortnights it
  // went the WRONG WAY for a child playing well — 50 down to 46 — because
  // selling out cost 3 a day and a fair price only earned 2, so reading the
  // forecast and stocking tightly quietly punished you.
  //
  // Regulars are a count you can see and count. They turn up whatever the
  // weather, on top of whoever happens to walk past, and you win them by
  // SERVING people: the ones you turn away don't punish you, they just never
  // become regulars. That is the honest shape of the loss, and it is what makes
  // a bigger stall grow faster than a small one.
  const REGULARS_START = 0;
  // Fourteen, and this is the number that sets the ceiling on the whole game.
  //
  // Regulars are the ONLY thing a child can grow. Passing trade is whatever the
  // weather says and the stall can hold no more than it holds, so once the
  // regulars stop climbing the business stops climbing, and every remaining day
  // earns exactly what the last one did. At eight that happened in week one.
  // Measured day by day over 1,200 fortnights, holding 75c and stocking to the
  // forecast:
  //
  //   regulars   0-0-2-4-6-7-7-7-8-8-8-8-8-8
  //   cups sold  5-8-11-13-15-17-18-18-19-19-19-19-19-19
  //
  // Eight days of a flat line. The stall was finished growing on day 7 and the
  // last seven mornings were the same morning, so the fortnight was pinned near
  // $85 however well it was played. That is what "you can't get past $60-70"
  // actually was — not a hard game, a game with nowhere left to go.
  //
  // At fourteen the same fortnight runs:
  //
  //   regulars   0-0-2-4-7-9-11-12-12-13-13-13-14-14
  //   cups sold  5-8-11-13-15-18-20-21-22-23-23-23-24-23
  //
  // Still climbing on the last day, which is the shape the game claims: the
  // first week is the business growing and the second is the business you
  // built, getting bigger because it is bigger. Measured over 1,500 fortnights
  // on Normal, stocking to the forecast finishes at $98 against $83, and the
  // top rung goes from 9% of well-played runs to 22%.
  //
  // The trade is that a full house is a bigger share of an ordinary day than it
  // was — about half a warm one. That is the proportion the game ran at when
  // this was twelve, and it is bought back by STALL_LIMIT going up with it. The
  // weather is still what the morning is about: at a full house the day swings
  // from 12 cups in the rain to 39 in a scorcher.
  const MAX_REGULARS = 14;
  // Serve this many cups for a full day's growth. 25 is comfortably more than an
  // ordinary day sells, so most days earn +1 regular and only the good ones earn
  // +2 — which is the compounding the run is meant to show. It stays at 25 now
  // that the cap is 14 and the stall holds 52: it is a weak lever either way
  // (22 is worth $3 over a fortnight and lands the cap half a day earlier,
  // because `back` is what really sets the pace), so it is chosen for the shape
  // of the growth rather than for its timing.
  const GROW_AT = 25;
  const SIGN_REGULARS = 3;   // what the big sign brings in on the spot

  // Loyalty is not immunity — nobody wants lemonade in freezing rain — but it
  // has to be close enough to it that "they come whatever the weather" is a fair
  // thing to tell a child. At [0.35, 0.6, …] only 74% of promised regulars
  // actually turned up across a fortnight; here it is 82%, and the morning says
  // the honest number for the day rather than the total either way.
  const REG_WEATHER = [0.5, 0.75, 1, 1, 1];

  // The two numbers the whole borrowing lesson rests on: the bank pays you 3c a
  // night for every dollar you leave with it, and charges you 6c a night for
  // every dollar you borrow — twice as much. The game says exactly that, and it
  // is the honest shape of a real bank as well as the teachable one.
  //
  // 5c was the first guess and it was too generous: measured over 2,000 runs it
  // made interest 48% of a well-played fortnight, which teaches "don't bother
  // trading". At 3c it lands near a quarter, which is plenty to see.
  const RATE = 3;
  const RATE_BONUS = 5; // on $20+, so there is one reason to think about how much
  const BONUS_AT = 2000;
  // The soft floor; a child is never locked out of their own game. It has to be
  // START_CASH and not a penny less, because the promise it makes is "you can
  // always buy the 5-cup pack" — and that pack costs the day's lemon price
  // times five, which now tops out at the same $3.00 you began with. At $2.00
  // it silently broke on any morning dearer than 40c a lemon, which is most of
  // them, and a broke child got a gift that bought nothing.
  const GRANDMA = 300;

  // What a trip to the bank costs. This is the number that makes the purse worth
  // having at all.
  //
  // Bank money is spendable — see affordable() for why that has to stay true —
  // and the bank pays interest, so without a fee "bank every last cent" was
  // strictly the right answer every single night, and the evening's question was
  // not a question. A flat fee, charged the first time you dip into the bank on
  // a given day and never again that day, makes it one: interest scales with the
  // pile and the fee doesn't, so banking the SURPLUS still wins by miles, while
  // keeping tomorrow's lemon money in your purse is what stops you paying a toll
  // every morning. That is the household lesson — keep a little cash to hand,
  // save the rest.
  //
  // 75c, and the size is measured, not picked — and it has been measured twice,
  // because it depends on how much a day's shopping costs and the rebalance
  // changed that. Keeping $X in your purse forgoes 3c per dollar per night, and
  // a float that is never banked also forgoes the EARLY compounding, which is
  // the part that matters most. So the fee has to beat both.
  //
  // At 25c, banking every last cent won outright and the mechanic was
  // decoration. 50c fixed that at the old footfall and stopped working at the
  // next one. 75c has now survived a third rebalance without moving: measured
  // over 1,200 fortnights of good play, keeping the float finishes $2.95 ahead
  // of banking every cent, and both finish about $20 ahead of never banking at
  // all. That is the right order for the three plays to come in, and it is the
  // only thing this number has to buy.
  const WITHDRAW_FEE = 75;
  // What a day's shopping costs, near enough: enough to cover most mornings
  // without leaving so much idle that the forgone interest outweighs the fee.
  // Re-measured at $4 / $6 / $8 / $10 against the new footfall. The curve is
  // almost flat above $6 — $1.15, $3.05, $2.95, $3.75 ahead of banking the lot —
  // so this stays where it was rather than chasing noise, and it still reads as
  // "about a day's lemons" on the evening screen, which is the point of it.
  const FLOAT = 800;

  // How many people walk past. Down by about a third from 6/10/16/23/29, and
  // that cut is the answer to the plainest complaint the game has had: that
  // buying the maximum was the right move most mornings, so there was no
  // morning question left to ask.
  //
  // The arithmetic behind it. A cup costs about 36c and sells for 75c, so an
  // extra cup pays for itself if it has a better than 48% chance of selling.
  // That means the profitable stock level sits just BELOW the day you expect —
  // and it can only sit below it if the day you expect is comfortably below
  // what the stall holds and what your purse can buy. At 29 passers-by against
  // a 45-cup stall neither was true: a scorcher wanted 41 of 45, so "fill it"
  // and "read the forecast" gave nearly the same answer, and the ice bucket
  // made the difference free.
  //
  // At these numbers, and with a full house of regulars, a warm day asks for
  // about 28 and a scorcher about 39 against a 52-cup stall. Measured over
  // 1,500 fortnights on Normal: stocking to the forecast finishes ahead of
  // filling the stall by $28, filling it bins 36% of what it buys, and a child
  // who never looks at the sky at all tops out at $75 and never sees the bike.
  const WEATHER = [
    { id: "cold",     emoji: "🌧️", name: "Cold and rainy", footfall: 5 },
    { id: "cloudy",   emoji: "⛅",  name: "Cloudy",         footfall: 9 },
    { id: "warm",     emoji: "🌤️", name: "Warm",           footfall: 14 },
    { id: "hot",      emoji: "☀️",  name: "Hot",            footfall: 20 },
    { id: "scorcher", emoji: "🔥",  name: "A scorcher",     footfall: 25 }
  ];

  // Five tiles, no typing. `pull` is what fraction of the passers-by would pay
  // this much; `back` is how many of them come back tomorrow as regulars if you
  // serve a full stall's worth at that price.
  //
  // These are tuned against PROFIT per passer-by, not revenue, because that is
  // what a run actually accumulates. At the average 36c cup:
  //
  //     25c   -11c margin x 1.70  =  -19   a busy stall losing money on every cup
  //     50c    14c margin x 1.35  =   19
  //     75c    39c margin x 1.00  =   39   <- the peak, and the answer
  //     $1.00  64c margin x 0.46  =   29
  //     $1.50 114c margin x 0.16  =   18
  //
  // The first cut had $1.00 at 0.62, which made it quietly the best price and
  // the game would have taught "charge as much as you can get away with".
  // 0.52 was the fix, and dearer lemons quietly undid it: a bigger margin helps
  // the dear price more than the fair one, and measured over 1,200 fortnights
  // $1.00 came back $3 AHEAD. 0.46 puts 75c back on top by $9 while leaving
  // $1.00 a respectable second — a fall-off, which teaches, rather than a cliff,
  // which just removes a button. Regulars then widen that gap over a fortnight
  // rather than creating it.
  const PRICES = [
    { cents: 25,  pull: 1.70, back: +3 },
    { cents: 50,  pull: 1.35, back: +3 },
    { cents: 75,  pull: 1.00, back: +2 },
    { cents: 100, pull: 0.46, back: +1 },
    { cents: 150, pull: 0.16, back: -3 }
  ];

  // The value lesson, in two buttons. The big pack is always cheaper per cup,
  // and the saving is shown in money on the button — never as a percentage.
  const PACKS = [
    { cups: 5,  discount: 1.00 },
    { cups: 15, discount: 0.80 }
  ];

  // Fixed repayment, stated up front, never changes. That sentence is the
  // entire anti-spiral design: debt in this game cannot grow.
  const LOANS = [
    { id: "small", borrow: 500,  repay: 650,  nights: 5, perNight: 30 },
    { id: "big",   borrow: 1000, repay: 1300, nights: 5, perNight: 60 }
  ];

  // `short` is for the shelf on the buying screen, where there is room for one
  // line and no more; `blurb` is for the shop sheet, which can afford a sentence.
  // Half, and the half is the whole point — this was the single biggest reason
  // "buy the maximum" was the right move every morning.
  //
  // "Leftovers keep till tomorrow" meant an unsold cup was not a loss, just a
  // cup bought early. So filling the stall stopped costing anything, and
  // measured over 1,500 fortnights a child who did it finished $16 AHEAD of one
  // who read the forecast, and took the bike 44% of the time. A game whose
  // lesson is "don't make more than you can sell" cannot sell a $4 item that
  // makes that lesson false.
  //
  // At half — and at $2.50 rather than $4 — the bucket is honest insurance
  // instead. Measured over 6,000 fortnights: it pays a child who stocks 20% over
  // the forecast $8 ($76.60 -> $84.55) and pays a child who stocks to it exactly
  // nothing at all ($84.15 either way), because a tight stall has no leftovers
  // to save. So it is worth buying once you have chosen to stock deep, and the
  // best it can do is bring stocking deep LEVEL with stocking right — never
  // ahead of it. That is the line this item has to stay on.
  const BUCKET_KEEPS = 0.5;

  // The odd cup goes IN the bucket, never in the bin — hence ceil and not floor.
  // Half of three is one and a half, and there is no half a cup, so somebody has
  // to get the spare one. Rounding it down meant a child with one cup left over
  // watched their $2.50 bucket save nothing at all, and a child with three
  // watched it save one and bin two — a bucket that keeps less than it throws
  // away, which is not what "half your leftovers keep" says and not what anyone
  // would do with a real bucket. It is worth about half a cup a day at most, so
  // it changes the shape of nothing; it just stops the item lying on odd numbers.
  const bucketKeeps = (wasted) => Math.ceil(wasted * BUCKET_KEEPS);

  const TREATS = [
    { id: "bucket", emoji: "🧊", name: "Ice bucket", short: "Half your leftovers keep till tomorrow.",
      blurb: "Half of the cups you don't sell keep until tomorrow. The rest still goes in the bin.",
      cost: 250, once: true },
    // The copy says the number the constant actually gives. It used to promise
    // ten and hand over five, which is the one thing a game about money must
    // never do.
    { id: "sign", emoji: "🪧", name: "A big sign",
      short: SIGN_REGULARS + " more regulars, then twice as fast.",
      blurb: SIGN_REGULARS + " more regulars right away, and from then on everyone you win " +
             "counts double — so your stall fills up with familiar faces much sooner.",
      cost: 300, once: true },
    { id: "cream", emoji: "🍦", name: "An ice cream, for you", short: "Does nothing at all. Very nice.",
      blurb: "It does nothing at all for the stall. It is just very nice.",
      cost: 150, once: false }
  ];

  /* ── The till ──────────────────────────────────────────────────────────── */

  // Real Australian money. No 1c or 2c coin has existed since 1992, which is
  // exactly why every price in this game is 5c-clean: the change always has to
  // be buildable out of these.
  const COINS = [5, 10, 20, 50, 100, 200];
  const NOTES = [500, 1000, 2000];

  // $1 and $2 are coins here; $5 and up are notes. The UI says "a $2 coin" or
  // "a $5 note" off the back of this rather than hardcoding the list twice.
  const isNote = (v) => v >= 500;

  const MAX_CHANGE = 1000; // $10 — past this the counting stops being countable

  // The smallest set of real coins adding up to n. Everything in this game is
  // 5c-clean, so greedy from the top is always exact.
  function coinsFor(n) {
    const out = [];
    let rest = n;
    for (let i = COINS.length - 1; i >= 0; i--) {
      while (rest >= COINS[i]) { out.push(COINS[i]); rest -= COINS[i]; }
    }
    return rest === 0 ? out : null;
  }

  // What a customer actually hands over — a handful, not a single note.
  //
  // The first version drew one piece of money at random, which gave four
  // possible payments per price and repeated inside a single fortnight. Four
  // shapes fixes that, and each one is a different sum to do:
  //
  //   a single piece      a $10 note                     -> $9.25
  //   rounded up          a $2 coin, a 20c and a 5c      -> $1.50
  //   a stray coin        a $2 coin and a 20c            -> $1.45
  //   two of the same     two $1 coins                   -> $1.25
  //
  // The rounded-up one is the interesting one: people really do hand over
  // $2.25 for a $1.75 cup to get a round 50c back, and spotting why is worth
  // knowing. Every piece is a denomination that exists — there is no 25c coin,
  // so "25c over" is built as a 20c and a 5c.
  function paymentFor(price, r) {
    const all = COINS.concat(NOTES);
    const bases = all.filter((v) => v > price && v - price <= MAX_CHANGE);
    if (!bases.length) return { parts: [all[all.length - 1]], total: all[all.length - 1] };

    const pick = (a) => a[r.int(a.length)];
    const shape = r.int(4);
    let parts = [pick(bases)];

    if (shape === 1) {
      // Pay a little over so the change comes back a round 50c or dollar.
      const due = parts[0] - price;
      const extra = Math.ceil((due + 1) / 50) * 50 - due;
      const coins = extra > 0 && extra <= 200 ? coinsFor(extra) : null;
      if (coins) parts = parts.concat(coins);
    } else if (shape === 2) {
      parts.push(pick(COINS));
    } else if (shape === 3) {
      const pairs = all.filter((v) => 2 * v > price && 2 * v - price <= MAX_CHANGE);
      if (pairs.length) { const v = pick(pairs); parts = [v, v]; }
    }

    let total = parts.reduce((a, b) => a + b, 0);
    // Any shape that overshot the countable range falls back to the plain note.
    if (total - price > MAX_CHANGE) { parts = [parts[0]]; total = parts[0]; }
    parts.sort((a, b) => b - a);
    return { parts, total };
  }

  // Not everybody buys one cup. A mum with two kids buys three; somebody grabs
  // a second for their mate. The cups are already decided by the demand model —
  // this only decides how those cups are grouped into people, so the economy is
  // untouched and the queue stops being a row of identical faces.
  //
  // It also makes the till sum a better one: two cups at 75c is a multiply
  // before it is a subtract.
  function partiesFor(seed, day, cups, singles) {
    const r = LS.Rng.stream(seed, day * 4441 + 9);
    const out = [];
    let left = cups;
    // Your regulars are at the front of the queue and buy one cup each — which
    // is what lets "12 regulars" mean "12 cups", on the screen and in the model.
    // Group them like everyone else and a count of people would quietly become a
    // count of cups, and the two numbers on screen would stop agreeing.
    const solo = Math.min(Math.max(0, singles || 0), left);
    for (let i = 0; i < solo; i++) out.push(1);
    left -= solo;
    while (left > 0) {
      // Most people buy one. A few buy two. Occasionally somebody buys three.
      let want = r.chance(0.68) ? 1 : r.chance(0.75) ? 2 : 3;
      if (want > left) want = left;
      out.push(want);
      left -= want;
    }
    return out;
  }

  // Which customer in the day pays with a handful instead of the exact money.
  // Deterministic from (seed, day) so a resumed day asks the same sum, and
  // `sp.changes` is 1 everywhere: one real piece of arithmetic a day is
  // practice, several is a chore that gets skipped through.
  //
  // Parties of two or three are picked out of the queue a little more often
  // than they occur, because those are the sums worth stopping for.
  function changeMoments(sp, seed, day, priceCents, parties) {
    if (!parties || !parties.length) return [];
    const r = LS.Rng.stream(seed, day * 7717 + 3);
    const n = Math.min(sp.changes, parties.length);
    const multi = parties.map((c, i) => i).filter((i) => parties[i] > 1);
    const out = [];
    const used = {};
    for (let i = 0; i < n; i++) {
      let at = multi.length && r.chance(0.45) ? multi[r.int(multi.length)] : r.int(parties.length);
      let guard = 0;
      while (used[at] && guard++ < 8) at = r.int(parties.length);
      used[at] = true;
      const cups = parties[at];
      const total = cups * priceCents;
      const pay = paymentFor(total, r);
      out.push({ at, cups, price: priceCents, total,
                 paid: pay.total, parts: pay.parts, due: pay.total - total });
    }
    return out.sort((a, b) => a.at - b.at);
  }

  // What handing over `given` actually does. Getting it right is worth a little;
  // getting it wrong costs exactly what a child would expect it to cost.
  function settleChange(moment, given, r) {
    const due = moment.due;
    if (given === due) {
      // Some people leave the odd coin. This is the reward for doing the sum,
      // and it went up when the till dropped to one customer a day — one sum
      // has to carry the weight two used to.
      const tip = r && r.chance(0.55) ? (r.chance(0.5) ? 20 : 50) : 0;
      return { ok: true, over: 0, short: 0, tip };
    }
    if (given > due) {
      // You handed over too much and they pocketed it. The money is simply gone,
      // which is the most honest lesson in the game.
      return { ok: false, over: given - due, short: 0, tip: 0 };
    }
    // Too little: they notice, they get the rest, and they remember.
    return { ok: false, over: 0, short: due - given, tip: 0 };
  }

  /* ── Days that don't go to plan ────────────────────────────────────────── */

  // Revealed when the stall OPENS, never in the morning. You commit your money
  // to stock and a price first, and then the world happens — that is what makes
  // it a risk rather than a sum.
  const EVENTS = [
    { id: "parade", emoji: "🎪", good: true, demand: 1.7,
      name: "A parade came past!", note: "Crowds everywhere. Everyone's thirsty." },
    { id: "school", emoji: "🎒", good: true, demand: 1.4,
      name: "School got out early", note: "A lot of thirsty kids walked right past you." },
    { id: "rival", emoji: "🏪", good: false, demand: 0.45,
      name: "Somebody set up a stall up the road", note: "They took half your customers today." },
    { id: "wasps", emoji: "🐝", good: false, lose: 0.4,
      name: "Wasps got into the lemonade", note: "You had to tip a lot of it away." },
    { id: "spill", emoji: "💦", good: false, lose: 0.25,
      name: "You knocked the jug over", note: "That's some of your lemonade on the grass." },
    { id: "shower", emoji: "🌦️", good: false, demand: 0.55,
      name: "A downpour, out of nowhere", note: "Everybody went home. Nobody buys lemonade in the rain." }
  ];

  const LEVELS = {
    // The top rung is meant to be RARE, and it had stopped being rare. Against
    // the old footfall a child who simply filled the stall every morning got
    // the bike 44% of the time — better than a child who read the forecast —
    // which is the balancing bug this whole file was re-measured to fix.
    //
    // Re-placed off the sweep in tools/check.js, 1,500 fortnights per row. The
    // goals themselves have not moved since; what moved was MAX_REGULARS, and
    // with the business able to grow all fortnight the same ladder now reads
    // the way it was always meant to. On Normal the bike goes to 26% of runs
    // that read the forecast and hold 75c, 22% of runs played really well
    // (pricing to the day, banking the surplus, getting the sums right), and
    // 16% of runs that fill the stall regardless and get lucky. Never adapting
    // to the weather reaches it never, and tops out at $75.
    //
    // It was 8-10% across the board before that, which is what the top of the
    // ladder being unreachable looks like from inside a run: two rungs that no
    // amount of playing well would move. The lower three are what a decent run
    // is actually for, and the first is within reach of anybody who trades.
    easy:   { id: "easy",   days: 7,  wobble: 8,  forecast: 1.00, drift: 1, bonusRate: false,
              eventRate: 0.16, badShare: 0.35, changes: 1, showTotal: true, bigLoan: false,
              goal: [800, 1600, 2600, 4000],
              rungs: ["🪀 a yo-yo", "🎨 paints", "🎧 headphones", "🛴 a scooter"] },
    normal: { id: "normal", days: 14, wobble: 15, forecast: 0.72, drift: 1, bonusRate: true,
              eventRate: 0.3, badShare: 0.62, changes: 1, showTotal: true, bigLoan: true,
              goal: [2500, 6000, 10000, 15000],
              rungs: ["🪀 a yo-yo", "🎧 headphones", "🛹 a skateboard", "🚲 a bike"] },
    tricky: { id: "tricky", days: 14, wobble: 22, forecast: 0.58, drift: 2, bonusRate: true,
              eventRate: 0.38, badShare: 0.7, changes: 1, showTotal: false, bigLoan: true,
              goal: [2500, 6000, 10000, 15000],
              rungs: ["🪀 a yo-yo", "🎧 headphones", "🛹 a skateboard", "🚲 a bike"] }
  };

  const spec = (difficulty) => LEVELS[difficulty] || LEVELS.normal;
  const priceTier = (cents) => PRICES.find((p) => p.cents === cents) || PRICES[2];

  /* ── The day, regenerated from (seed, day) ─────────────────────────────── */

  // Weather is a clamped random walk rather than an independent draw each day,
  // so it drifts instead of whiplashing. That is the only thing that makes
  // yesterday worth remembering and a forecast worth reading.
  function weatherOn(seed, day) {
    let w = 2;
    for (let d = 1; d <= day; d++) {
      w = clamp(w + (LS.Rng.stream(seed, d * 977).int(3) - 1), 0, WEATHER.length - 1);
    }
    return w;
  }

  // Today's surprise, if there is one. Most days there isn't. Day one never has
  // one — nobody has learned the game yet — and the good/bad mix is a difficulty
  // setting, because "some days just go wrong" is the part that has to be true
  // for saving up to mean anything.
  function eventOn(sp, seed, day) {
    if (day === 1) return null;
    const r = LS.Rng.stream(seed, day * 613);
    if (!r.chance(sp.eventRate)) return null;
    const bad = r.chance(sp.badShare);          // decided once, then pick from that half
    const pool = EVENTS.filter((e) => e.good !== bad);
    return pool[r.int(pool.length)];
  }

  // Everything about today that the player did not decide. Pure in (seed, day),
  // which is why the save blob can hold a seed instead of a pre-rolled fortnight.
  function dayOf(sp, seed, day) {
    const r = LS.Rng.stream(seed, day);
    const weather = weatherOn(seed, day);

    // Lemons cost what they cost today. Quantised to 5c so the shopping
    // arithmetic stays mental — 45c a cup, not 37c a cup.
    //
    // 45c, up from 40c, and the nickel is doing real work. It is the difference
    // between an extra cup needing a 43% chance of selling to be worth buying
    // and needing 48% — which is what moves the best stall from a little ABOVE
    // the day you expect to a little below it. The clamp stays at 60c so the
    // 5-cup pack never costs more than the $3.00 you start with; that is the
    // promise that day one is always playable.
    const unit = clamp(cents5(45 + Math.round((r.next() * 2 - 1) * sp.wobble)), 30, 60);

    // The forecast is a REPORT on the weather, and on the harder settings it is
    // sometimes a step out. Buying for a forecast that misses is the risk being
    // taught, so it has to be able to miss.
    // A wrong forecast has to actually be wrong. Clamping a drift at the ends of
    // the scale used to land back on the truth, which quietly made Tricky's
    // forecast 69% reliable when it advertises 60%.
    let forecast = weather;
    if (!r.chance(sp.forecast)) {
      const options = [clamp(weather + sp.drift, 0, WEATHER.length - 1),
                       clamp(weather - sp.drift, 0, WEATHER.length - 1)]
        .filter((w) => w !== weather);
      if (options.length) forecast = options[r.int(options.length)];
    }

    return { day, weather, forecast, unit, event: eventOn(sp, seed, day), sure: sp.forecast === 1 };
  }

  // What a pack costs today, and what the big one saves against buying small.
  const packPrice = (unit, pack) => cents5(Math.round(unit * pack.cups * pack.discount));
  const packSaving = (unit) => packPrice(unit, PACKS[0]) * 3 - packPrice(unit, PACKS[1]);

  /* ── Demand ────────────────────────────────────────────────────────────── */

  // How many cups people want today, split into the two halves a child can
  // actually reason about: the strangers walking past, which the weather
  // decides, and your own regulars, which YOU built.
  //
  // Both halves are monotonically non-increasing in price — that is the one
  // property a child needs to be able to trust, and it is why the loyalty
  // factor is written off `pull` rather than as its own table that could drift
  // out of order with it.
  // What fraction of your regulars turn up, before the day's surprises. The UI
  // shows the morning's estimate off this same function, so what the weather
  // step promises and what walks up to the stall cannot disagree.
  function regularShare(weatherIndex, priceCents) {
    const tier = priceTier(priceCents);
    const loyal = Math.min(1, 0.5 + tier.pull / 2);
    return REG_WEATHER[weatherIndex] * loyal;
  }

  // The morning's honest estimate: the FORECAST rather than the weather, and no
  // event, because you don't know either yet. Display only.
  const regularsExpected = (regulars, forecastIndex, priceCents) =>
    Math.min(regulars || 0, Math.round((regulars || 0) * regularShare(forecastIndex, priceCents)));

  function wanted(info, priceCents, regulars, seed) {
    const tier = priceTier(priceCents);
    const ev = info.event && info.event.demand ? info.event.demand : 1;
    const jitter = 0.85 + LS.Rng.stream(seed, info.day * 31 + 7).next() * 0.3;
    const passing = Math.max(0,
      Math.round(WEATHER[info.weather].footfall * tier.pull * ev * jitter));

    // Regulars forgive a price rise a stranger wouldn't, and a rival stall up
    // the road only tempts away some of them — that is the whole value of
    // having them, and it is what makes a bad day survivable.
    //
    // A good event only ever brings STRANGERS. A parade cannot make a regular
    // turn up twice, and letting it try is how the game came to print "20
    // regulars" in the morning and then serve 26 of them in the afternoon.
    // Every factor here is <= 1 for exactly that reason: turnout can never
    // exceed the number of regulars you have.
    const evReg = Math.min(1, ev);
    const regs = Math.max(0, Math.min(regulars || 0,
      Math.round((regulars || 0) * regularShare(info.weather, priceCents) * evReg)));

    return { passing, regulars: regs, total: passing + regs };
  }

  // The day's trading, decided in full the moment the stall opens. ui.js animates
  // this afterwards and cannot change a number in it — Yatzy's rule, and the
  // reason a stale timer can't tick money into tomorrow.
  function sell(run, info) {
    // Wasps and spilt jugs take their cut before anybody is served. This is the
    // money you had already spent, gone, through nothing you did wrong — which
    // is the point of it being here.
    const lost = info.event && info.event.lose ? Math.round(run.cups * info.event.lose) : 0;
    const stock = Math.max(0, run.cups - lost);
    const crowd = wanted(info, run.price, run.regulars, run.seed);
    const want = crowd.total;
    const sold = Math.min(want, stock);
    // How those cups were grouped into people, so the queue and the till both
    // know that the third customer bought two.
    // Regulars are served first — they know when you open — so the cups that go
    // to them are the first ones sold.
    const regularCups = Math.min(crowd.regulars, sold);
    const parties = partiesFor(run.seed, info.day, sold, regularCups);
    return {
      want,
      sold,
      parties,
      lost,                       // destroyed before opening, never sellable
      turned: want - sold,        // cups people wanted and didn't get
      wasted: stock - sold,       // lemonade doesn't keep, unless you bought the bucket
      earned: sold * run.price,   // 5c-clean: every tier is a multiple of 25c
      wantedRegulars: crowd.regulars,
      wantedPassing: crowd.passing,
      // A stall that runs out disappoints strangers before it disappoints its
      // own. One cup each, so this is a count of people as well as of cups.
      regularCups,
      moments: changeMoments(spec(run.difficulty), run.seed, info.day, run.price, parties)
    };
  }

  // Tonight's word of mouth: how many people liked your stall enough to make it
  // their stall. Returns the whole story rather than a number, because the
  // evening has to be able to say WHY it moved.
  //
  // Growth scales with how many you served, so a bigger stall grows faster —
  // that is the compounding the game is about — but it is capped per day rather
  // than proportional, which keeps the loop linear and the run measurable.
  function nextRegulars(run, result) {
    const tier = priceTier(run.price);
    const before = run.regulars;
    let gained = 0;
    let lost = 0;

    if (result.shut) {
      lost += 1;                       // you weren't there; somebody else was
    } else if (tier.back < 0) {
      lost += -tier.back;              // that is not a price, that is a liberty
    } else {
      const reach = Math.min(1, result.sold / GROW_AT);
      gained += Math.round(tier.back * reach * (run.treats.sign ? 2 : 1));
    }
    // Running out doesn't cost you the people you turned away — they were never
    // yours. It costs you one, because word gets round that you sell out.
    if (!result.shut && result.turned > result.sold) lost += 1;
    // Short-changing people is remembered, and remembered hard: regulars feed
    // demand for the rest of the run, so this is the lever that keeps one sum a
    // day mattering to where you finish.
    lost += 2 * (run.changeWrong || 0);

    const raw = before + gained - lost;
    return { before, after: clamp(raw, 0, MAX_REGULARS), gained, lost,
             capped: raw > MAX_REGULARS, shut: !!result.shut,
             gouged: tier.back < 0, soldOut: !result.shut && result.turned > result.sold,
             wrongChange: run.changeWrong || 0 };
  }

  /* ── Interest, both directions ─────────────────────────────────────────── */

  // 5c on the dollar, every night. Absurd for a real bank and exactly right for
  // a fortnight: $10 left alone becomes $19.80 by day 14, which a child can SEE.
  // The how-to says out loud that real banks are much slower than this one.
  function interestOn(bank, sp) {
    const rate = sp.bonusRate && bank >= BONUS_AT ? RATE_BONUS : RATE;
    return { rate, paid: cents5(Math.floor((bank * rate) / 100)) };
  }

  // What the open loan costs tonight. DISPLAY ONLY — it moves no money, because
  // the repayment is a fixed figure agreed when the loan was taken. Showing it
  // accruing is what makes it read as interest rather than as a flat fee.
  function loanTonight(run) {
    if (!run.loan) return null;
    const L = LOANS.find((l) => l.id === run.loan.id);
    const nightsGone = clamp(run.day - run.loan.taken + 1, 0, L.nights);
    return { perNight: L.perNight, soFar: L.perNight * nightsGone, total: L.repay - L.borrow };
  }

  /* ── Borrowing ─────────────────────────────────────────────────────────── */

  // Which loans the bank will offer right now. One at a time, so total debt is
  // bounded by $13.00 at every instant of every run; and never one that would
  // fall due after the last day, so a run always resolves its debt.
  function loanOffers(run) {
    if (run.loan) return [];
    const sp = spec(run.difficulty);
    return LOANS.filter((L) => {
      if (L.id === "big" && (!sp.bigLoan || run.day === 1)) return false;
      return run.day + L.nights <= sp.days;
    });
  }

  function takeLoan(run, id) {
    const L = LOANS.find((l) => l.id === id);
    if (!L || !loanOffers(run).some((o) => o.id === id)) return null;
    run.loan = { id: L.id, borrow: L.borrow, repay: L.repay, due: run.day + L.nights, taken: run.day };
    run.pocket += L.borrow;
    run.borrowedToday += L.borrow;
    return run.loan;
  }

  // Settled automatically on the due morning, bank first then pocket. If both
  // together fall short the bank takes what there is and writes the rest off:
  // balances are never negative, debt never grows, and there is no game over.
  function dueRepayment(run) {
    const L = run.loan;
    if (!L || run.day < L.due) return null;
    const fromBank = Math.min(run.bank, L.repay);
    const fromPocket = Math.min(run.pocket, L.repay - fromBank);
    const written = L.repay - fromBank - fromPocket;
    run.bank -= fromBank;
    run.pocket -= fromPocket;
    run.loan = null;
    return { repaid: fromBank + fromPocket, written, borrowed: L.borrow, repay: L.repay,
             cost: L.repay - L.borrow };
  }

  // Nobody sits out the last four days of a fortnight because day 9 went badly.
  function grandma(run) {
    if (run.cups > 0 || run.pocket + run.bank >= GRANDMA) return 0;
    const gift = GRANDMA - (run.pocket + run.bank);
    run.pocket += gift;
    return gift;
  }

  /* ── Shopping ──────────────────────────────────────────────────────────── */

  // Everything you own is spendable. Money comes out of the pocket first and out
  // of the bank behind it, instantly — bank money is never LOCKED.
  //
  // This is deliberate, and the game would teach the OPPOSITE lesson without it.
  // If banking locked money away until morning, then banking your takings would
  // starve the stall of the cash it needs to buy tomorrow's lemons, and
  // stuffing the money under the mattress would win. Measured: pocketing
  // everything finished at $136 against banking's $48 before this existed.
  // The lesson here is "money you leave alone grows", not a liquidity puzzle.
  //
  // What reaching into the bank does cost is one 25c trip, once a day. See
  // WITHDRAW_FEE.
  const dipsIntoBank = (run, amount) => amount > run.pocket;

  // The fee this purchase would trigger: nothing if your purse covers it, and
  // nothing if you have already been to the bank today.
  function feeFor(run, amount) {
    if (!dipsIntoBank(run, amount) || run.bank <= 0 || run.feePaid) return 0;
    return WITHDRAW_FEE;
  }

  // What the purchase really costs you today, trip included. This is the number
  // the buying screen shows — a child should never tap a $4.80 button and find
  // $5.05 gone without having been told.
  const costOf = (run, amount) => amount + feeFor(run, amount);

  // The biggest single thing you could buy right now, fee included. Emptying the
  // purse without touching the bank is always allowed, which is why this is a
  // max of the two ways rather than one sum.
  function affordable(run) {
    if (run.bank <= 0 || run.feePaid) return run.pocket + run.bank;
    return Math.max(run.pocket, run.pocket + run.bank - WITHDRAW_FEE);
  }

  const canAfford = (run, amount) => costOf(run, amount) <= run.pocket + run.bank;

  function spend(run, amount) {
    const fee = feeFor(run, amount);
    const total = amount + fee;
    if (total > run.pocket + run.bank) return false;
    const fromPocket = Math.min(run.pocket, total);
    run.pocket -= fromPocket;
    run.bank -= total - fromPocket;
    if (fee > 0) { run.feePaid = true; run.feesToday += fee; }
    return true;
  }

  function buyPack(run, info, index) {
    const pack = PACKS[index];
    if (!pack) return null;
    const cost = packPrice(info.unit, pack);
    if (run.cups + pack.cups > STALL_LIMIT) return null;
    const fee = feeFor(run, cost);
    // The fee is not part of what the lemons cost, and never gets added to
    // spentToday — the evening has to be able to say "lemons $4.80" and
    // "trip to the bank 25c" as two separate facts.
    if (!spend(run, cost)) return null;
    run.cups += pack.cups;
    run.spentToday += cost;
    run.boughtToday += pack.cups;
    return { cups: pack.cups, cost, fee };
  }

  const treatById = (id) => TREATS.find((t) => t.id === id);

  // Two of these earn their money back and one does nothing at all, on purpose.
  // The lesson is which kind of spending is worth it, not "never spend".
  function treatAvailable(run, id) {
    const t = treatById(id);
    if (!t) return false;
    if (t.id === "cream") return !run.treats.creamsOn.includes(run.day);
    return !run.treats[t.id];
  }

  function buyTreat(run, id) {
    const t = treatById(id);
    if (!t || !treatAvailable(run, id)) return null;
    const fee = feeFor(run, t.cost);
    if (!spend(run, t.cost)) return null;
    run.treatToday += t.cost;
    if (t.id === "cream") run.treats.creamsOn.push(run.day);
    else {
      run.treats[t.id] = true;
      if (t.id === "sign") run.regulars = clamp(run.regulars + SIGN_REGULARS, 0, MAX_REGULARS);
    }
    return Object.assign({ fee }, t);
  }

  /* ── The run ───────────────────────────────────────────────────────────── */

  function newRun(difficulty, seed) {
    const sp = spec(difficulty);
    return {
      difficulty: sp.id,
      seed: seed >>> 0,
      day: 1,
      phase: "morning",
      pocket: START_CASH,
      bank: 0,
      regulars: REGULARS_START,
      cups: 0,
      carry: 0,
      price: 75, // preselected so the Open button lights up on the first purchase
      spentToday: 0,
      boughtToday: 0,
      treatToday: 0,
      borrowedToday: 0,
      // One trip to the bank a day, so the fee can't be charged twice for
      // buying lemons and then a bucket ten seconds later.
      feePaid: false,
      feesToday: 0,
      // The till, for today only. None of it is real money until closeDay pays
      // the day in, so a day abandoned half-served simply replays.
      tipsToday: 0,
      overpaidToday: 0,
      changeAt: 0,
      changeRight: 0,
      changeWrong: 0,
      loan: null,
      treats: { bucket: false, sign: false, creamsOn: [] },
      ledger: [],
      today: null,
      result: null,
      growth: null,     // what tonight's word of mouth did, for the evening card
      opening: null // what the bank did to you before you could touch anything
    };
  }

  // Entering a morning. Three things happen before the child touches anything,
  // in this order, and all three are reported on the morning card.
  function startDay(run) {
    const sp = spec(run.difficulty);
    const repay = dueRepayment(run);
    const gift = grandma(run);
    run.today = dayOf(sp, run.seed, run.day);
    run.cups = run.carry;
    run.carry = 0;
    run.spentToday = 0;
    run.boughtToday = 0;
    run.treatToday = 0;
    run.borrowedToday = 0;
    run.feePaid = false;
    run.feesToday = 0;
    resetTill(run);
    run.result = null;
    run.growth = null;
    run.phase = "morning";
    run.opening = { repay, gift };
    return run.opening;
  }

  function setPrice(run, cents) {
    if (priceTier(cents).cents === cents) run.price = cents;
    return run.price;
  }

  // Decide the whole day, then hand it to the animation.
  //
  // Zero cups is a legal day, not an error. Lemons can cost 60c on a morning
  // when Grandma's $2.00 is all there is, and a child who can't afford stock
  // still has to be able to reach tomorrow — so this returns an honest empty
  // day rather than a null the caller has to special-case.
  function openStall(run) {
    // The till starts empty every time the stall opens, so a day left half-served
    // and picked up later replays from the beginning rather than paying twice.
    resetTill(run);
    run.result = run.cups > 0
      ? sell(run, run.today)
      : { want: 0, sold: 0, parties: [], lost: 0, turned: 0, wasted: 0, earned: 0, moments: [], shut: true };
    run.phase = "selling";
    return run.result;
  }

  function resetTill(run) {
    run.tipsToday = 0;
    run.overpaidToday = 0;
    run.changeAt = 0;
    run.changeRight = 0;
    run.changeWrong = 0;
  }

  // Hand over `given` cents to the customer waiting at moment index `i`.
  // Nothing here touches the balances: the day is paid in as one lump at
  // closeDay, so a half-finished day can never leave money behind.
  function giveChange(run, given) {
    const r = run.result;
    if (!r || !r.moments || run.changeAt >= r.moments.length) return null;
    const moment = r.moments[run.changeAt];
    const rng = LS.Rng.stream(run.seed, run.day * 991 + run.changeAt);
    const out = settleChange(moment, given, rng);
    run.changeAt++;
    run.tipsToday += out.tip;
    run.overpaidToday += out.over;
    if (out.ok) run.changeRight++; else run.changeWrong++;
    return Object.assign({ moment }, out);
  }

  function closeDay(run) {
    const r = run.result;
    // Everything the day made, all at once: cups sold, plus what people left as
    // a thank-you, minus whatever was handed back over the odds.
    run.pocket += r.earned + run.tipsToday - run.overpaidToday;
    // Kept on the run so the evening can show the sum, and so a resumed evening
    // shows the same one rather than recomputing it against moved numbers.
    run.growth = nextRegulars(run, r);
    run.regulars = run.growth.after;
    run.carry = run.treats.bucket ? bucketKeeps(r.wasted) : 0;
    run.phase = "evening";
    return r;
  }

  // "all" | "float" | "half" | "none" — how much of the pocket goes in tonight.
  // "float" is the one worth naming: it banks everything except tomorrow's lemon
  // money, which is the answer the withdrawal fee is quietly teaching.
  function bankChoice(run, choice) {
    const move = choice === "all" ? run.pocket
      : choice === "float" ? Math.max(0, run.pocket - FLOAT)
      : choice === "half" ? cents5(Math.floor(run.pocket / 2))
      : 0;
    run.pocket -= move;
    run.bank += move;
    return move;
  }

  // The night. Interest lands, the loan's running cost is noted (it moves no
  // money), and the day is written into the ledger.
  function night(run) {
    const sp = spec(run.difficulty);
    const bankBefore = run.bank;
    const int = interestOn(run.bank, sp);
    run.bank += int.paid;

    const r = run.result;
    const o = run.opening || { repay: null, gift: 0 };
    const loanCost = loanTonight(run);
    // Money thrown away: cups nobody bought, plus any the wasps got. Display
    // only — it moves nothing, it just names what the waste was worth.
    const binned = run.boughtToday > 0
      ? cents5(Math.round(((r.wasted + (r.lost || 0)) * run.spentToday) / run.boughtToday))
      : 0;

    run.ledger.push({
      day: run.day,
      weather: run.today.weather,
      unit: run.today.unit,
      price: run.price,
      cups: r.sold + r.wasted + (r.lost || 0),
      sold: r.sold,
      turned: r.turned,
      wasted: r.wasted,
      lost: r.lost || 0,
      event: run.today.event ? run.today.event.id : null,
      spent: run.spentToday,
      earned: r.earned,
      tips: run.tipsToday,
      overpaid: run.overpaidToday,
      changeRight: run.changeRight,
      changeWrong: run.changeWrong,
      profit: r.earned + run.tipsToday - run.overpaidToday - run.spentToday,
      binned,                                  // display only, moves no money
      treatCost: run.treatToday,
      fees: run.feesToday,                     // trips to the bank
      loanCost: loanCost ? loanCost.perNight : 0, // display only, moves no money
      borrowed: run.borrowedToday,
      repaid: o.repay ? o.repay.repaid : 0,
      written: o.repay ? o.repay.written : 0,
      // What that loan cost once it was settled: what you handed back minus what
      // you were given. Negative if the bank wrote debt off, which is honest —
      // a written-off loan really did leave you ahead in cash, and broke.
      loanNet: o.repay ? o.repay.repaid - o.repay.borrowed : 0,
      grandma: o.gift,
      interest: int.paid,
      rate: int.rate,
      regulars: run.regulars,
      regularCups: r.regularCups || 0,
      pocket: run.pocket,
      bank: run.bank
    });

    run.phase = "night";
    // Everything the bank book needs, worked out here rather than re-derived by
    // the UI — the panel shows a sum, and a sum should have one author.
    return { interest: int, loan: loanCost, binned,
             bankBefore, bankAfter: run.bank, paidSoFar: totalInterest(run) };
  }

  // Move to tomorrow, or end the run.
  function nextDay(run) {
    const sp = spec(run.difficulty);
    if (run.day >= sp.days) {
      run.phase = "over";
      return false;
    }
    run.day++;
    startDay(run);
    return true;
  }

  // Every cent the bank has paid across the run. Called after tonight's row is
  // pushed, so it includes tonight.
  const totalInterest = (run) => run.ledger.reduce((n, row) => n + row.interest, 0);

  // The bank balance at the end of each night so far — what the little bar
  // chart draws.
  const bankHistory = (run) => run.ledger.map((row) => row.bank);

  /* ── Scoring ───────────────────────────────────────────────────────────── */

  const wealth = (run) => run.pocket + run.bank;

  function rungReached(final, goals) {
    let n = 0;
    for (const g of goals) if (final >= g) n++;
    return n;
  }

  function summary(run) {
    const sp = spec(run.difficulty);
    const add = (k) => run.ledger.reduce((n, row) => n + (row[k] || 0), 0);
    const final = wealth(run);
    return {
      final,
      traded: add("profit"),
      interest: add("interest"),
      owed: add("loanNet"),   // what borrowing cost, across every settled loan
      borrowed: add("borrowed"),
      binned: add("binned"),
      tips: add("tips"),
      overpaid: add("overpaid"),
      changeRight: add("changeRight"),
      changeWrong: add("changeWrong"),
      lost: add("lost"),
      treats: add("treatCost"),
      fees: add("fees"),
      written: add("written"),
      creams: run.treats.creamsOn.length,
      regulars: run.regulars,
      regularCups: add("regularCups"),
      rung: rungReached(final, sp.goal),
      target: sp.goal[sp.goal.length - 1],
      prize: sp.rungs[sp.rungs.length - 1],
      won: final >= sp.goal[sp.goal.length - 1]
    };
  }

  // The two lines on the end-of-run chart. `wealth` is what you actually had;
  // `lemonade` is what you would have had if the bank had never paid you a cent.
  // The gap between them IS the interest — exact by construction, because it is
  // the running total subtracted, not a second simulation to keep in step.
  function series(run) {
    const wealthLine = [START_CASH];
    const lemonadeLine = [START_CASH];
    let interestSoFar = 0;
    for (const row of run.ledger) {
      interestSoFar += row.interest;
      wealthLine.push(row.pocket + row.bank);
      lemonadeLine.push(row.pocket + row.bank - interestSoFar);
    }
    return { wealth: wealthLine, lemonade: lemonadeLine };
  }

  // One sentence, chosen by what actually happened, in priority order. It says
  // what happened and what it cost — not "well done".
  function takeaway(run) {
    const s = summary(run);
    const sp = spec(run.difficulty);
    if (s.written > 0) {
      return "You borrowed more than the stall could pay back. Next time, borrow only when a hot day is coming.";
    }
    if (s.overpaid > 0 && s.overpaid >= s.tips) {
      return "You handed out " + money(s.overpaid) + " too much in change. Money given away by mistake is gone just as surely as money spent.";
    }
    if (s.changeRight > 0 && s.changeWrong === 0) {
      return "You got every single sum at the till right, and people left you " +
        money(s.tips) + " in tips for it. Being careful pays.";
    }
    if (s.regulars >= MAX_REGULARS) {
      return "You finished with " + s.regulars + " regulars — people who came to your stall " +
        "every single day because you looked after them. That is what a business is.";
    }
    if (s.fees > 0 && s.fees >= s.interest) {
      return "You paid " + money(s.fees) + " in trips to the bank — as much as the bank paid you. " +
        "Keep tomorrow's lemon money in your purse and that stays yours.";
    }
    if (s.interest > 0 && s.traded > 0 && s.interest * 3 >= s.traded) {
      return "Look at that — the bank paid you " + money(s.interest) +
        " for doing nothing at all. Money you leave alone works while you sleep.";
    }
    if (s.creams > 0 && s.treats >= sp.goal[Math.min(s.rung, sp.goal.length - 1)] - s.final) {
      return "You had " + s.creams + (s.creams === 1 ? " ice cream" : " ice creams") + " for " +
        money(s.treats) + ". That was money that never made it to the goal.";
    }
    if (s.binned > 0 && s.traded > 0 && s.binned * 4 >= s.traded) {
      return "You threw away " + money(s.binned) + " of lemonade. Buying only what you can sell is money in your purse.";
    }
    if (s.interest > 0) {
      return "The bank paid you " + money(s.interest) + " this fortnight. Bank it earlier next time and it pays you for longer.";
    }
    return "You kept your money in your purse all fortnight. Try leaving it in the bank — it grows every single night.";
  }

  /* ── Saving ────────────────────────────────────────────────────────────── */

  // The seed plus the ledger IS the run: every forecast, lemon price and thirsty
  // customer regenerates from (seed, day), so a resumed run cannot disagree with
  // what it showed before, and the blob stays small.
  //
  // Returns null for a phase that cannot be brought back, and the caller is
  // expected to keep whatever record it already had rather than write the null
  // down. "night" is the one that matters: by then the day is in the ledger and
  // the interest is paid, but the counters have not been cleared and the day has
  // not turned over — and restore() would hand that day straight back to be
  // played a second time. The evening before it is a complete, honest picture,
  // so that is what stays on disk.
  function snapshot(run) {
    if (!run || run.phase === "over" || run.phase === "night") return null;
    return {
      difficulty: run.difficulty, seed: run.seed, day: run.day, phase: run.phase,
      pocket: run.pocket, bank: run.bank, regulars: run.regulars,
      growth: run.growth,
      cups: run.cups, carry: run.carry, price: run.price,
      spentToday: run.spentToday, boughtToday: run.boughtToday,
      treatToday: run.treatToday, borrowedToday: run.borrowedToday,
      feePaid: !!run.feePaid, feesToday: run.feesToday,
      tipsToday: run.tipsToday, overpaidToday: run.overpaidToday,
      changeAt: run.changeAt, changeRight: run.changeRight, changeWrong: run.changeWrong,
      loan: run.loan ? { id: run.loan.id, borrow: run.loan.borrow, repay: run.loan.repay,
                         due: run.loan.due, taken: run.loan.taken } : null,
      treats: { bucket: run.treats.bucket, sign: run.treats.sign,
                creamsOn: run.treats.creamsOn.slice() },
      ledger: run.ledger.slice(),
      opening: run.opening,
      // Carried explicitly rather than recomputed. By the evening the earnings
      // are already in `pocket`, so re-running sell() on restore would either
      // pay the day twice or quietly disagree with the balance that was saved.
      result: run.result ? Object.assign({}, run.result) : null
    };
  }

  const whole5 = (v) => Number.isInteger(v) && v >= 0 && v % 5 === 0;

  // Rebuilt rather than trusted. Anything that fails a check returns null, which
  // simply means the Resume button doesn't appear — a corrupt save is never
  // allowed to become a broken game.
  function restore(snap) {
    try {
      if (!snap || !LEVELS[snap.difficulty]) return null;
      const sp = spec(snap.difficulty);
      if (!Number.isInteger(snap.day) || snap.day < 1 || snap.day > sp.days) return null;
      if (!whole5(snap.pocket) || !whole5(snap.bank)) return null;
      if (!Number.isInteger(snap.cups) || snap.cups < 0 || snap.cups > STALL_LIMIT) return null;
      if (!priceTier(snap.price) || priceTier(snap.price).cents !== snap.price) return null;
      if (!Array.isArray(snap.ledger)) return null;
      if (snap.loan) {
        const L = LOANS.find((l) => l.id === snap.loan.id);
        if (!L || snap.loan.repay !== L.repay || snap.loan.borrow !== L.borrow) return null;
      }

      const run = newRun(snap.difficulty, snap.seed);
      run.day = snap.day;
      run.pocket = snap.pocket;
      run.bank = snap.bank;
      // Saves written before regulars existed carry a 0-100 `rep` instead. There
      // is no sensible conversion, so such a run simply starts building its
      // regulars from where a new one would.
      run.regulars = Number.isInteger(snap.regulars)
        ? clamp(snap.regulars, 0, MAX_REGULARS) : REGULARS_START;
      run.growth = snap.growth || null;
      run.cups = snap.cups;
      run.carry = snap.carry || 0;
      run.price = snap.price;
      run.spentToday = snap.spentToday || 0;
      run.boughtToday = snap.boughtToday || 0;
      run.treatToday = snap.treatToday || 0;
      run.borrowedToday = snap.borrowedToday || 0;
      run.feePaid = !!snap.feePaid;
      run.feesToday = snap.feesToday || 0;
      run.tipsToday = snap.tipsToday || 0;
      run.overpaidToday = snap.overpaidToday || 0;
      run.changeAt = snap.changeAt || 0;
      run.changeRight = snap.changeRight || 0;
      run.changeWrong = snap.changeWrong || 0;
      run.loan = snap.loan ? Object.assign({}, snap.loan) : null;
      run.treats = { bucket: !!snap.treats.bucket, sign: !!snap.treats.sign,
                     creamsOn: (snap.treats.creamsOn || []).slice() };
      run.ledger = snap.ledger.slice();
      run.opening = snap.opening || { repay: null, gift: 0 };
      run.today = dayOf(sp, run.seed, run.day);

      // Only three phases are resumable, and each restores differently:
      //   morning  — nothing decided yet, just re-enter the shop
      //   selling  — the day is decided but unpaid; keep the saved result so the
      //              animation replays to the same number it was going to reach
      //   evening  — already paid into `pocket`; keep the result for the sums
      //              panel and never re-apply it
      // "night" and "over" are never saved — snapshot() refuses them, because a
      // night that came back here would come back as the morning of a day the
      // ledger already has, and get played again.
      const resumable = snap.phase === "selling" || snap.phase === "evening";
      run.phase = resumable && snap.result ? snap.phase : "morning";
      run.result = run.phase === "morning" ? null : Object.assign({}, snap.result);
      if (run.phase === "morning" && run.cups === 0 && !run.boughtToday) run.cups = run.carry;
      return run;
    } catch (e) {
      return null;
    }
  }

  return {
    // money
    cents5, money, price, clamp,
    // constants
    START_CASH, STALL_LIMIT, RATE, RATE_BONUS, BONUS_AT, GRANDMA,
    WITHDRAW_FEE, FLOAT, BUCKET_KEEPS, bucketKeeps,
    REGULARS_START, MAX_REGULARS, GROW_AT, SIGN_REGULARS,
    WEATHER, PRICES, PACKS, LOANS, TREATS, LEVELS,
    COINS, NOTES, EVENTS,
    spec, priceTier,
    // the day
    dayOf, weatherOn, eventOn, packPrice, packSaving,
    // trading
    wanted, regularShare, regularsExpected, sell, nextRegulars,
    // the till
    paymentFor, coinsFor, isNote, partiesFor, changeMoments, settleChange, giveChange, resetTill,
    // banking
    interestOn, loanTonight, loanOffers, takeLoan, dueRepayment, grandma,
    // shopping
    buyPack, buyTreat, treatAvailable, treatById,
    affordable, canAfford, costOf, feeFor, dipsIntoBank, spend,
    // the run
    newRun, startDay, setPrice, openStall, closeDay, bankChoice, night, nextDay,
    // scoring
    wealth, rungReached, summary, series, takeaway, totalInterest, bankHistory,
    // saving
    snapshot, restore
  };
})();
