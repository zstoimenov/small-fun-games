/* Footy Tactics Lab — the block palette and the sequence workspace.
   Tap a palette block to add it; drag a block in the workspace to move it. */
"use strict";
window.FTL = window.FTL || {};

FTL.Blocks = (function () {

  const DEFS = {
    MOVE_FORWARD: { label: "Move Forward", icon: "👟", kind: "move" },
    ROTATE_LEFT:  { label: "Turn Left",    icon: "↺",  kind: "turn" },
    ROTATE_RIGHT: { label: "Turn Right",   icon: "↻",  kind: "turn" },
    HANDBALL:     { label: "Handball",     icon: "🤾", kind: "handball" },
    KICK_GOAL:    { label: "Kick Goal",    icon: "🥅", kind: "kick" },
    REPEAT:       { label: "Repeat",       icon: "🔁", kind: "repeat" }
  };

  const MAX_DEPTH = 2;   // a Repeat inside a Repeat, and no deeper

  let paletteEl = null, workspaceEl = null, emptyEl = null;
  let level = null;
  let tree = [];
  let seq = 0;
  let locked = false;              // true while a play is running
  let target = null;               // id of the Repeat blocks get added into
  let changeCb = function () {};
  let denyCb = function () {};

  const uid = () => "b" + (++seq);
  const count = () => FTL.Engine.countBlocks(tree);

  /* ── Model helpers ────────────────────────────────────────────────────── */

  // Returns the array a node lives in, plus its index and depth.
  function locate(id, nodes, depth) {
    nodes = nodes || tree; depth = depth || 0;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return { list: nodes, index: i, node: nodes[i], depth: depth };
      if (nodes[i].type === "REPEAT") {
        const hit = locate(id, nodes[i].body, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }

  function listFor(containerId) {
    if (!containerId) return tree;
    const hit = locate(containerId);
    return hit && hit.node.type === "REPEAT" ? hit.node.body : tree;
  }

  function depthOf(containerId) {
    if (!containerId) return 0;
    const hit = locate(containerId);
    return hit ? hit.depth + 1 : 0;
  }

  function contains(node, id) {
    if (node.id === id) return true;
    if (node.type !== "REPEAT") return false;
    return node.body.some((c) => contains(c, id));
  }

  /* ── Adding & removing ────────────────────────────────────────────────── */

  function add(type) {
    if (locked) return;
    if (count() >= level.maxBlocks) {
      denyCb("Your play is full — " + level.maxBlocks + " blocks is the limit. Try a Repeat!");
      FTL.Audio.denied();
      shakeCount();
      return;
    }
    const intoDepth = depthOf(target);
    if (type === "REPEAT" && intoDepth >= MAX_DEPTH) {
      denyCb("That's as deep as Repeats go.");
      FTL.Audio.denied();
      return;
    }
    const node = type === "REPEAT"
      ? { id: uid(), type: "REPEAT", n: 2, body: [] }
      : { id: uid(), type: type };
    listFor(target).push(node);
    if (type === "REPEAT") target = node.id;   // new Repeat becomes the drop target
    FTL.Audio.tap();
    render();
  }

  function remove(id) {
    if (locked) return;
    const hit = locate(id);
    if (!hit) return;
    hit.list.splice(hit.index, 1);
    if (target && !locate(target)) target = null;
    FTL.Audio.remove();
    render();
  }

  function bumpRepeat(id, delta) {
    if (locked) return;
    const hit = locate(id);
    if (!hit) return;
    hit.node.n = Math.max(2, Math.min(10, hit.node.n + delta));
    FTL.Audio.tap();
    render();
  }

  function setTarget(id) {
    if (target === id) return;
    target = id;
    FTL.Audio.tap();
    render();
  }

  function clear() {
    if (locked) return;
    tree = []; target = null;
    render();
  }

  function shakeCount() {
    const el = document.getElementById("blockCount");
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  /* ── Rendering ────────────────────────────────────────────────────────── */

  function renderPalette() {
    paletteEl.innerHTML = "";
    level.allowedBlocks.forEach((type) => {
      const def = DEFS[type];
      const b = document.createElement("button");
      b.className = "block block-" + def.kind + " palette-block";
      b.type = "button";
      b.dataset.type = type;
      b.innerHTML = '<span class="block-icon">' + def.icon + '</span>' +
                    '<span class="block-label">' + def.label + '</span>';
      b.addEventListener("click", () => add(type));
      paletteEl.appendChild(b);
    });
  }

  function targetChip() {
    const chip = document.createElement("span");
    chip.className = "target-chip";
    chip.textContent = "＋ new blocks land here";
    return chip;
  }

  function blockEl(node) {
    const def = DEFS[node.type];
    const el = document.createElement("div");
    el.className = "block block-" + def.kind + " ws-block";
    el.dataset.id = node.id;
    el.dataset.type = node.type;

    const head = document.createElement("div");
    head.className = "block-head";
    head.innerHTML = '<span class="grip" aria-label="Drag to move">⠿</span>' +
                     '<span class="block-icon">' + def.icon + '</span>' +
                     '<span class="block-label">' + def.label + '</span>';

    if (node.type === "REPEAT") {
      const stepper = document.createElement("span");
      stepper.className = "stepper";
      stepper.innerHTML =
        '<button type="button" class="step-btn" data-step="-1" aria-label="Fewer times">−</button>' +
        '<b class="step-n">' + node.n + '×</b>' +
        '<button type="button" class="step-btn" data-step="1" aria-label="More times">+</button>';
      head.appendChild(stepper);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del-btn";
    del.setAttribute("aria-label", "Remove this block");
    del.textContent = "✕";
    head.appendChild(del);
    el.appendChild(head);

    if (node.type === "REPEAT") {
      const body = document.createElement("div");
      body.className = "block-body" + (target === node.id ? " targeted" : "");
      body.dataset.container = node.id;
      node.body.forEach((child) => body.appendChild(blockEl(child)));
      if (!node.body.length && target !== node.id) {
        const hint = document.createElement("span");
        hint.className = "body-hint";
        hint.textContent = "Tap the Repeat bar to fill this in";
        body.appendChild(hint);
      }
      if (target === node.id) body.appendChild(targetChip());
      el.appendChild(body);
    }
    return el;
  }

  function render() {
    workspaceEl.innerHTML = "";
    const root = document.createElement("div");
    root.className = "block-body root-body" + (target === null ? " targeted" : "");
    root.dataset.container = "";
    tree.forEach((node) => root.appendChild(blockEl(node)));
    if (target === null && tree.length) root.appendChild(targetChip());
    workspaceEl.appendChild(root);

    if (emptyEl) emptyEl.hidden = tree.length > 0;
    workspaceEl.classList.toggle("locked", locked);
    changeCb(count(), level.maxBlocks);
  }

  /* ── Highlighting during a run ────────────────────────────────────────── */

  function highlight(id, kind) {
    clearHighlights();
    if (!id) return;
    const el = workspaceEl.querySelector('[data-id="' + id + '"]');
    if (!el) return;
    el.classList.add(kind);
    revealWithin(el);
  }

  // Nudge the workspace's own scrollbar, never the page's. scrollIntoView()
  // walks up every scrollable ancestor, which in the stacked portrait layout
  // scrolls the document and takes the oval off screen mid-run — exactly when
  // the player is the thing you need to be watching.
  function revealWithin(el) {
    const room = workspaceEl.scrollHeight - workspaceEl.clientHeight;
    if (room <= 1) return;
    const host = workspaceEl.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    let delta = 0;
    if (box.top < host.top + 4) delta = box.top - host.top - 8;
    else if (box.bottom > host.bottom - 4) delta = box.bottom - host.bottom + 8;
    if (delta) workspaceEl.scrollTop = Math.max(0, Math.min(room, workspaceEl.scrollTop + delta));
  }
  function clearHighlights() {
    workspaceEl.querySelectorAll(".running,.failed").forEach((el) => {
      el.classList.remove("running", "failed");
    });
  }

  /* ── Dragging to reorder ──────────────────────────────────────────────── */

  let drag = null;

  // Drags start from the grip only, so the workspace can still scroll normally
  // on a touchscreen — the grip is the one spot with touch-action:none.
  function onPointerDown(e) {
    if (locked || e.button > 0) return;
    if (!e.target.closest(".grip")) return;
    const el = e.target.closest(".ws-block");
    if (!el) return;
    drag = {
      id: el.dataset.id, el: el, pointerId: e.pointerId,
      x0: e.clientX, y0: e.clientY, active: false, floater: null, placeholder: null
    };
    workspaceEl.setPointerCapture(e.pointerId);
  }

  function startDrag(e) {
    const rect = drag.el.getBoundingClientRect();
    drag.offX = drag.x0 - rect.left;
    drag.offY = drag.y0 - rect.top;

    const floater = drag.el.cloneNode(true);
    floater.classList.add("floating");
    floater.style.width = rect.width + "px";
    document.body.appendChild(floater);
    drag.floater = floater;

    // The marker is absolutely positioned, so moving it never reflows the
    // list. If it took up space the layout would shift under the pointer and
    // the drop target would flicker between containers.
    const ph = document.createElement("div");
    ph.className = "placeholder";
    workspaceEl.appendChild(ph);
    drag.placeholder = ph;

    drag.el.classList.add("dragging");   // display:none — out of the flow for good
    drag.active = true;
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 8) return;
      startDrag(e);
    }
    e.preventDefault();
    drag.floater.style.left = (e.clientX - drag.offX) + "px";
    drag.floater.style.top = (e.clientY - drag.offY) + "px";
    positionPlaceholder(e.clientX, e.clientY);
  }

  // Find the body under the pointer that this block is allowed into, work out
  // which of its children the block would land between, and draw the marker
  // there. The chosen spot is remembered for the drop.
  function positionPlaceholder(px, py) {
    const under = document.elementFromPoint(px, py);
    if (!under) return;

    const body = under.closest(".block-body");
    if (!body || !workspaceEl.contains(body)) return;

    // never drop a Repeat inside itself, and respect the nesting limit
    if (drag.el.contains(body)) return;
    const node = locate(drag.id).node;
    if (depthOf(body.dataset.container || null) + maxDepth(node) > MAX_DEPTH) return;

    const kids = Array.from(body.children).filter(
      (c) => c.classList.contains("ws-block") && c !== drag.el
    );
    let before = null;
    for (const kid of kids) {
      const r = kid.getBoundingClientRect();
      if (py < r.top + r.height / 2) { before = kid; break; }
    }

    drag.dropBody = body;
    drag.dropBefore = before;

    // draw the marker line, in coordinates relative to the workspace
    const host = workspaceEl.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    let top;
    if (before) top = before.getBoundingClientRect().top - 3;
    else if (kids.length) top = kids[kids.length - 1].getBoundingClientRect().bottom + 1;
    else top = bodyRect.top + bodyRect.height / 2 - 2;

    const ph = drag.placeholder;
    ph.style.left = (bodyRect.left - host.left + workspaceEl.scrollLeft + 4) + "px";
    ph.style.width = Math.max(20, bodyRect.width - 8) + "px";
    ph.style.top = (top - host.top + workspaceEl.scrollTop) + "px";
  }

  function maxDepth(node) {
    if (node.type !== "REPEAT" || !node.body.length) return 0;
    return 1 + Math.max.apply(null, node.body.map(maxDepth));
  }

  function onPointerUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.active) return;

    if (d.dropBody) {
      const dest = listFor(d.dropBody.dataset.container || null);
      // kids already excludes the dragged block, so this index is the one to
      // splice into once the block has been lifted out of its old list
      const kids = Array.from(d.dropBody.children).filter(
        (c) => c.classList.contains("ws-block") && c !== d.el
      );
      const index = d.dropBefore ? kids.indexOf(d.dropBefore) : kids.length;

      const hit = locate(d.id);
      hit.list.splice(hit.index, 1);
      dest.splice(Math.max(0, Math.min(dest.length, index)), 0, hit.node);
      FTL.Audio.tap();
    }

    d.floater.remove();
    d.el.classList.remove("dragging");
    d.placeholder.remove();
    render();
  }

  function dropDrag() {
    if (!drag) return;
    if (drag.active) {
      drag.floater.remove();
      drag.el.classList.remove("dragging");
      drag.placeholder.remove();
    }
    drag = null;
  }

  function cancelDrag() { dropDrag(); render(); }

  /* ── Wiring ───────────────────────────────────────────────────────────── */

  function mount(palette, workspace, empty) {
    paletteEl = palette;
    workspaceEl = workspace;
    emptyEl = empty;

    workspaceEl.addEventListener("pointerdown", onPointerDown);
    workspaceEl.addEventListener("pointermove", onPointerMove);
    workspaceEl.addEventListener("pointerup", onPointerUp);
    workspaceEl.addEventListener("pointercancel", cancelDrag);

    workspaceEl.addEventListener("click", (e) => {
      if (locked) return;
      const del = e.target.closest(".del-btn");
      if (del) { remove(del.closest(".ws-block").dataset.id); return; }

      const step = e.target.closest(".step-btn");
      if (step) { bumpRepeat(step.closest(".ws-block").dataset.id, Number(step.dataset.step)); return; }

      // Tapping a Repeat's header says "put the next block inside me"; tapping
      // it again puts you back out at the top level. A Repeat's body fills up
      // with blocks, so its header is the only reliably tappable part of it.
      const head = e.target.closest(".block-head");
      if (head) {
        const owner = head.closest(".ws-block");
        if (owner.dataset.type === "REPEAT") {
          setTarget(target === owner.dataset.id ? null : owner.dataset.id);
        }
        return;
      }

      const body = e.target.closest(".block-body");
      setTarget(body && body.dataset.container ? body.dataset.container : null);
    });
  }

  function setLevel(lv) {
    level = lv;
    tree = [];
    target = null;
    locked = false;
    renderPalette();
    render();
  }

  return {
    mount: mount, setLevel: setLevel,
    getTree: function () { return tree; },
    setTree: function (t) { tree = t; target = null; render(); },
    describe: function (type) { return DEFS[type]; },
    count: count,
    clear: clear,
    highlight: highlight, clearHighlights: clearHighlights,
    setLocked: function (v) { locked = !!v; if (v) dropDrag(); render(); },
    onChange: function (cb) { changeCb = cb; },
    onDeny: function (cb) { denyCb = cb; }
  };
})();
