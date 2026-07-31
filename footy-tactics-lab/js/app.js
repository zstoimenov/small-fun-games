/* Footy Tactics Lab — main entry: level lifecycle, run/reset, PWA registration */
"use strict";
window.FTL = window.FTL || {};

(function () {

  const { Levels, Audio, Game, Engine, Blocks } = FTL;
  const $ = (id) => document.getElementById(id);

  let level = null;
  let running = false;
  let toastTimer = null;

  /* ── Little helpers ───────────────────────────────────────────────────── */

  const stars = (n) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);

  /* The on-field readout. The workspace can be scrolled away, off to the side
     or below the fold, so the block that is executing right now is mirrored
     onto the oval itself — the field and the player never leave the screen. */
  function showNowPlaying(type, meta, failed) {
    const def = Blocks.describe(type);
    const el = $("nowPlaying");
    if (!def) { el.hidden = true; return; }
    el.className = "now-playing block block-" + def.kind + (failed ? " failed" : "");
    $("npIcon").textContent = def.icon;
    $("npLabel").textContent = def.label;
    $("npMeta").textContent = meta || "";
    $("npMeta").hidden = !meta;
    el.hidden = false;
    // restart the pop animation on every step, so repeats visibly tick over
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
  }

  function hideNowPlaying() { $("nowPlaying").hidden = true; }

  function toast(text, ms) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 2600);
  }

  /* ── Level select ─────────────────────────────────────────────────────── */

  function renderLevelSelect() {
    const grid = $("levelGrid");
    grid.innerHTML = "";
    Levels.LEVELS.forEach((lv) => {
      const unlocked = Levels.isUnlocked(lv.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "level-card" + (unlocked ? "" : " locked");
      card.disabled = !unlocked;
      card.innerHTML =
        '<span class="level-no">' + lv.id + '</span>' +
        '<span class="level-t">' + (unlocked ? lv.title : "Locked") + '</span>' +
        '<span class="level-c">' + (unlocked ? lv.concept : "🔒") + '</span>' +
        '<span class="level-s">' + (unlocked ? stars(Levels.starsFor(lv.id)) : "") + '</span>';
      card.addEventListener("click", () => startLevel(lv.id));
      grid.appendChild(card);
    });
    $("totalStars").textContent = "⭐ " + Levels.totalStars() + " / " + Levels.MAX_STARS;
  }

  function showMenu() {
    Engine.stop();
    running = false;
    renderLevelSelect();
    $("levelSelect").hidden = false;
    $("game").hidden = true;
    closeResult();
  }

  /* ── Playing a level ──────────────────────────────────────────────────── */

  function startLevel(id) {
    level = Levels.byId(id);
    if (!level) return;

    $("levelSelect").hidden = true;
    closeResult();
    $("game").hidden = false;

    $("levelTitle").textContent = "Level " + level.id + ": " + level.title;
    $("levelConcept").textContent = level.concept;
    $("levelStars").textContent = stars(Levels.starsFor(level.id));

    Blocks.setLevel(level);
    Game.setLevel(level);
    resetRun();
    toast(level.hint, 4200);
  }

  function resetRun() {
    Engine.stop();
    running = false;
    Blocks.setLocked(false);
    Blocks.clearHighlights();
    hideNowPlaying();
    Game.reset();
    $("runBtn").textContent = "RUN LOGIC ▶";
    $("runBtn").disabled = false;
  }

  function run() {
    if (running) { resetRun(); return; }
    const tree = Blocks.getTree();
    if (!Engine.countBlocks(tree)) { toast("Add some blocks first! 👉", 2200); return; }

    running = true;
    Blocks.setLocked(true);
    Blocks.clearHighlights();
    Game.reset();
    $("runBtn").textContent = "■ STOP";

    // in the stacked portrait layout the oval can be scrolled off the top —
    // put it back before the first block runs
    const doc = document.scrollingElement;
    if (doc && doc.scrollTop > 0) window.scrollTo({ top: 0, behavior: "smooth" });

    const blockCount = Engine.countBlocks(tree);

    Engine.run(tree, level, {
      onStep: function (blockId, type, info) {
        Blocks.highlight(blockId, "running");
        const loop = info.loops[info.loops.length - 1];
        let meta = (info.index + 1) + " of " + info.total;
        if (loop) meta += "  🔁 " + loop.pass + "/" + loop.of;
        showNowPlaying(type, meta, false);
      },

      onApply: function (from, to, effect) {
        if (effect === "move") Audio.step();
        else if (effect === "turn") Audio.turn();
        else if (effect === "handball") Audio.handball();
        if (effect === "goal") {
          Audio.kick();
          Game.kickBall(from, level.goalPos, 520);
        } else {
          Game.animateTo(to, effect, 320);
        }
      },

      onFail: function (blockId, reason, at) {
        running = false;
        Blocks.setLocked(false);
        if (blockId) {
          Blocks.highlight(blockId, "failed");
          const el = document.querySelector('[data-id="' + blockId + '"]');
          if (el) showNowPlaying(el.dataset.type, "", true);
        } else {
          hideNowPlaying();
        }
        if (at) Game.flashTile(at[0], at[1], "bad");
        Audio.whistle();
        toast("📣 " + Engine.message(reason), 5200);
        $("runBtn").textContent = "↺ TRY AGAIN";
      },

      onWin: function () {
        running = false;
        Blocks.setLocked(false);
        $("runBtn").textContent = "RUN LOGIC ▶";
        setTimeout(() => {
          Audio.goal();
          Game.celebrate();
          hideNowPlaying();
          const earned = Levels.recordWin(level.id, blockCount);
          $("levelStars").textContent = stars(Levels.starsFor(level.id));
          showResult(earned, blockCount);
        }, 520);
      }
    });
  }

  function showResult(earned, blockCount) {
    const last = level.id >= Levels.LEVELS.length;
    $("resultIcon").textContent = earned === 3 ? "🏆" : "🏉";
    $("resultTitle").textContent = earned === 3 ? "GOAL! Perfect play!" : "GOAL!";
    $("resultStars").textContent = stars(earned);
    $("resultText").textContent = earned === 3
      ? "Slotted it in " + blockCount + " blocks — that's the best there is."
      : "Slotted it in " + blockCount + " blocks. Do it in " + level.par + " for three stars!";
    $("nextBtn").textContent = last ? "🎉 Finish" : "Next level ▶";
    $("peekPill").hidden = true;
    document.body.classList.remove("peeking");
    $("result").hidden = false;
  }

  // The card lands on top of the pitch, and the run that just happened is
  // what there is to learn from. Peek puts it aside; the pill brings it back.
  function closeResult() {
    $("result").hidden = true;
    $("peekPill").hidden = true;
    document.body.classList.remove("peeking");
  }

  function peekPitch() {
    $("result").hidden = true;
    $("peekPill").hidden = false;
    // The run is finished, so the block buttons have nothing to do — standing
    // them down is what leaves room for the pill at the bottom.
    document.body.classList.add("peeking");
  }

  /* ── Boot-time check that every level is still winnable ───────────────── */

  function selfTest() {
    const broken = [];
    Levels.LEVELS.forEach((lv) => {
      const tree = Levels.solutionTree(lv);
      const blocks = Engine.countBlocks(tree);
      const res = Engine.simulate(tree, lv);
      if (!res.won) broken.push("L" + lv.id + " unsolvable (" + res.reason + ")");
      else if (blocks > lv.maxBlocks) broken.push("L" + lv.id + " needs " + blocks + " > maxBlocks " + lv.maxBlocks);
      else if (blocks > lv.par) broken.push("L" + lv.id + " needs " + blocks + " > par " + lv.par);
    });
    if (broken.length) console.error("[Footy Tactics Lab] level check FAILED:\n" + broken.join("\n"));
    else console.log("[Footy Tactics Lab] all " + Levels.LEVELS.length + " levels solvable at par.");
    return broken;
  }

  /* ── Wiring ───────────────────────────────────────────────────────────── */

  Levels.load();
  Audio.setMuted(Levels.isMuted());
  $("muteBtn").textContent = Levels.isMuted() ? "🔇" : "🔊";

  Game.mount($("oval"));
  Blocks.mount($("palette"), $("workspace"), $("workspaceEmpty"));
  Blocks.onChange(function (n, max) {
    $("blockCount").textContent = n + " / " + max;
    $("blockCount").classList.toggle("full", n >= max);
  });
  Blocks.onDeny(function (msg) { toast(msg, 2800); });

  $("runBtn").addEventListener("click", run);
  $("resetBtn").addEventListener("click", resetRun);
  $("clearBtn").addEventListener("click", function () {
    if (running) resetRun();
    Blocks.clear();
  });
  $("hintBtn").addEventListener("click", function () { toast("💡 " + level.hint, 5200); });
  $("menuBtn").addEventListener("click", showMenu);
  $("peekBtn").addEventListener("click", peekPitch);
  $("peekPill").addEventListener("click", function () {
    $("peekPill").hidden = true;
    document.body.classList.remove("peeking");
    $("result").hidden = false;
  });
  $("againBtn").addEventListener("click", function () {
    closeResult();
    resetRun();
  });
  $("nextBtn").addEventListener("click", function () {
    closeResult();
    const next = Levels.byId(level.id + 1);
    if (next) { Audio.unlock(); startLevel(next.id); } else showMenu();
  });
  $("muteBtn").addEventListener("click", function () {
    const m = !Levels.isMuted();
    Levels.setMuted(m);
    Audio.setMuted(m);
    $("muteBtn").textContent = m ? "🔇" : "🔊";
    if (!m) Audio.tap();
  });
  $("resetProgress").addEventListener("click", function () {
    if (!confirm("Start the whole lab again? Your stars will be cleared.")) return;
    Levels.resetProgress();
    renderLevelSelect();
  });

  selfTest();
  showMenu();

  // Exposed so the smoke tests can drive the game without clicking through.
  FTL.debug = {
    startLevel: startLevel, selfTest: selfTest, showMenu: showMenu,
    loadTree: function (t) { Blocks.setTree(t); }
  };

  // Game Box uses a single service worker at the site root (../sw.js).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("../sw.js").catch(function () {});
    });
  }
})();
