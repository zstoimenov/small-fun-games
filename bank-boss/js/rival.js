/* Bank Boss — the bank across the street.                                      */
/*                                                                              */
/* There is a rival in BOTH modes, and in solo it is not decoration. Without     */
/* somewhere else for a saver to go, paying 1c a night would simply be correct   */
/* and the save dial would not be a decision. The rival is the reason a rate     */
/* has to be competitive, which is the reason banks pay interest at all.         */
/*                                                                              */
/* Difficulty touches the rival and NOTHING else — not the customers, not the    */
/* rates you may set, not what a loan costs. Deal or No Deal proved why by       */
/* breaking when it didn't: tune the world as well as the opponent and the       */
/* levels stop being a ladder.                                                   */
"use strict";
window.BB = window.BB || {};

BB.Rival = (function () {
  const B = () => BB.Bank;

  /* ── Rates ─────────────────────────────────────────────────────────────── */

  // Easy is a bank that gouges: it pays as little as it can, charges as much as
  // it can, and wonders why its counter fills up with Dodgy Dave. It is losable
  // to on purpose, and it is losable to for a reason a child can name.
  //
  // Medium is the sensible middle of the dial and never changes its mind.
  //
  // Medium and Hard both run the fair middle of the dial. What separates them is
  // not the rates — an adaptive rate rule was tried and MEASURED WORSE than
  // holding the middle, which is worth knowing before writing another one — it
  // is the two disciplines underneath: Hard keeps its keep-back line, and Hard
  // turns away money it has nothing to do with.
  function rates(run, bank, level) {
    if (level === "easy") return { save: 1, loan: 10 };
    return { save: 2, loan: 8 };
  }

  /* ── Lending ───────────────────────────────────────────────────────────── */

  // Easy lends to anybody who asks. Medium and Hard know what a star is worth —
  // no rate on the dial makes a one-star loan pay — and Hard also refuses to
  // lend below its own keep-back line, which is the discipline that costs a
  // careless child the most.
  function lend(run, bank, c) {
    const Bk = B();
    const level = run.robotLevel || "medium";
    if (bank.cash < c.amount) return false;
    if (level === "easy") return true;
    if (Bk.person(c.id).star === 1) return false;
    if (level === "medium") return true;
    // Hard keeps its own keep-back line, which is the discipline that costs a
    // careless child the most: it is almost never the one having to call its
    // loans in at 75c in the dollar.
    return bank.cash - c.amount >= Bk.reserveNeeded(bank);
  }

  /* ── Deposits ──────────────────────────────────────────────────────────── */

  // A robot takes money it can use and turns away money it cannot. Easy has
  // never heard of the idea and takes everything, which is most of why its
  // vault fills up with coins it pays for and never lends.
  function takeDeposit(run, bank, c) {
    const Bk = B();
    if (run.robotLevel !== "hard") return true;
    // Only Hard has worked out that money it cannot lend costs it every night.
    // Room for roughly two more loans on top of the keep-back line means the
    // money has somewhere to go.
    return Bk.spare(bank) < 8000;
  }

  /* ── The morning ───────────────────────────────────────────────────────── */

  // Called for every robot seat at the top of the day. In two-player there is no
  // robot seat and this does nothing at all.
  function takeMorning(run) {
    run.banks.forEach((bank, i) => {
      if (bank.who !== "robot") return;
      const r = rates(run, bank, run.robotLevel || "medium");
      B().setRates(run, i, r.save, r.loan);
    });
  }

  return { rates, lend, takeDeposit, takeMorning };
})();
