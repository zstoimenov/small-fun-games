/* Design Studio - the paint pot: tap paints to add drops, watch the colour.   */
/*                                                                             */
/* mixer(box, { paints, target, onMatch, onEmpty, onChange }) -> { pot, hex }. */
/* Like real paint, a drop can't come back out: too much and you empty the    */
/* pot and start again. That's the whole lesson of the "Mud!" level.          */
"use strict";
window.DS = window.DS || {};

DS.MATCH = 5;       // delta E under this counts as the same colour
DS.POT_MAX = 12;    // drops before the pot is full

DS.mixer = function (root, o) {
  const C = DS.Colour, A = DS.Audio;
  const target = o.target ? C.mix(o.target) : null;
  let pot = {}, done = false;

  root.innerHTML = `<div class="mix-top">
      <figure class="blob-box"><div class="blob pot-blob"></div><figcaption>Your paint</figcaption></figure>
      ${target ? `<figure class="blob-box"><div class="blob" style="background:${target}"></div><figcaption>Make this</figcaption></figure>` : ""}
    </div>
    ${target ? '<div class="close"><div class="meter"><i></i></div><p class="close-say" aria-live="polite"></p></div>' : ""}
    <div class="pots"></div>
    <p class="drops"></p>
    <div class="actions"><button type="button" class="btn ghost empty-btn">🫗 Empty the pot</button></div>`;
  const blob = root.querySelector(".pot-blob"), pots = root.querySelector(".pots"), dropsP = root.querySelector(".drops");

  C.PAINTS.filter((p) => o.paints.includes(p.id)).forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "paint";
    b.innerHTML = `<span class="tube" style="background:${p.hex}"></span><b>${p.name}</b><small class="n"></small>`;
    b.setAttribute("aria-label", "Add a drop of " + p.name.toLowerCase());
    b.dataset.paint = p.id;
    b.addEventListener("click", () => add(p.id));
    pots.appendChild(b);
  });

  function paint() {
    const hex = C.mix(pot);
    blob.style.background = hex || "transparent";
    blob.classList.toggle("empty", !hex);
    pots.querySelectorAll(".paint").forEach((b) => { const n = pot[b.dataset.paint] || 0; b.querySelector(".n").textContent = n ? "×" + n : ""; });
    const n = C.drops(pot);
    dropsP.textContent = n ? n + " drop" + (n > 1 ? "s" : "") + " in the pot" : "The pot is empty. Tap a paint!";
    if (!target) return;
    const d = hex ? C.distance(hex, target) : 100;
    const pct = hex ? Math.max(4, Math.min(100, 100 - (d - DS.MATCH) * 2.2)) : 0;
    root.querySelector(".meter i").style.width = pct + "%";
    root.querySelector(".close-say").textContent = !hex ? "" : d < DS.MATCH ? "A perfect match! 🎉" : pct > 80 ? "So close!" : pct > 50 ? "Getting there..." : "Keep mixing";
  }
  function add(id) {
    if (done) return;
    if (C.drops(pot) >= DS.POT_MAX) { dropsP.textContent = "The pot is full! Empty it and try again."; A.wrong(); return; }
    pot[id] = (pot[id] || 0) + 1;
    A.plop();
    blob.classList.remove("wobble"); void blob.offsetWidth; blob.classList.add("wobble");
    paint();
    if (o.onChange) o.onChange(C.mix(pot));
    if (target && C.distance(C.mix(pot), target) < DS.MATCH) {
      done = true;
      pots.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      root.querySelector(".empty-btn").disabled = true;
      if (o.onMatch) o.onMatch();
    }
  }
  root.querySelector(".empty-btn").addEventListener("click", () => {
    if (!C.drops(pot)) return;
    pot = {};
    A.pour();
    paint();
    if (o.onEmpty) o.onEmpty();
    if (o.onChange) o.onChange(null);
  });
  paint();
  return { get pot() { return pot; }, hex: () => C.mix(pot) };
};
