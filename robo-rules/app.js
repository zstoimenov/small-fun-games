/* Robo Rules — teach Chip the robot with IF-THIS-THEN-THAT rules */
"use strict";

/* ---------------- Data ---------------- */

const TRIGGERS = [
  { id: "rain",   emoji: "🌧️", label: "It rains",        banner: "🌧️ It started raining!" },
  { id: "sun",    emoji: "☀️", label: "Sun shines",      banner: "☀️ The sun came out!" },
  { id: "music",  emoji: "🎵", label: "Music plays",     banner: "🎵 Music is playing!" },
  { id: "ball",   emoji: "⚽", label: "Ball rolls in",   banner: "⚽ A ball rolled in!" },
  { id: "hungry", emoji: "🍽️", label: "Chip is hungry",  banner: "🍽️ Chip's tummy is rumbling!" },
  { id: "sleepy", emoji: "😴", label: "Chip is sleepy",  banner: "😴 Chip is suuuper sleepy!" },
  { id: "mud",    emoji: "💩", label: "Chip gets muddy", banner: "💩 Chip stepped in mud!" },
  { id: "hi",     emoji: "👋", label: "Someone says hi", banner: "👋 Someone says HI to Chip!" },
];

const ACTIONS = [
  { id: "eat",      emoji: "🍕", label: "Eat pizza",      anim: "jump",   prop: "🍕", burst: "😋", say: "Yum yum yum!" },
  { id: "sleep",    emoji: "💤", label: "Take a nap",     anim: "sleep",  prop: "",   burst: "💤", say: "Zzzzzz…" },
  { id: "dance",    emoji: "🕺", label: "Dance",          anim: "dance",  prop: "",   burst: "🎶", say: "Robot dance time!" },
  { id: "umbrella", emoji: "☂️", label: "Open umbrella",  anim: "wiggle", prop: "☂️", burst: "💧", say: "Staying dry!" },
  { id: "chase",    emoji: "🎾", label: "Chase the ball", anim: "chase",  prop: "⚽", burst: "💨", say: "Gotta catch it!" },
  { id: "bath",     emoji: "🛁", label: "Take a bath",    anim: "wiggle", prop: "🛁", burst: "🫧", say: "Scrub scrub!" },
  { id: "wave",     emoji: "👋", label: "Wave hello",     anim: "jump",   prop: "",   burst: "👋", say: "Hello friend!" },
  { id: "spin",     emoji: "🌀", label: "Spin around",    anim: "spin",   prop: "",   burst: "🌀", say: "Wheee!" },
  { id: "sing",     emoji: "🎤", label: "Sing a song",    anim: "wiggle", prop: "🎤", burst: "🎵", say: "Beep boop laa laa!" },
  { id: "hide",     emoji: "📦", label: "Hide in a box",  anim: "hide",   prop: "📦", burst: "❔", say: "(you can't see me)" },
];

const ACCESSORIES = [
  { id: "cap",     emoji: "🧢", slot: "hat",  label: "Cool cap" },
  { id: "shades",  emoji: "🕶️", slot: "face", label: "Sunglasses" },
  { id: "bow",     emoji: "🎀", slot: "neck", label: "Bow tie" },
  { id: "party",   emoji: "🥳", slot: "hat",  label: "Party hat" },
  { id: "crown",   emoji: "👑", slot: "hat",  label: "Crown" },
  { id: "rainbow", emoji: "🌈", slot: "hat",  label: "Rainbow" },
];

const MISSIONS = [
  {
    id: "first-rule",
    text: "Teach Chip his FIRST rule! Pick a WHEN and a THEN below, then press ✨ Teach Chip!",
    check: (ev) => ev.type === "ruleAdded",
    reward: "cap",
  },
  {
    id: "first-match",
    text: "Make it happen! Press the ⚡ event button that matches your rule — watch Chip obey!",
    check: (ev) => ev.type === "match",
    reward: "shades",
  },
  {
    id: "stump",
    text: "Stump Chip! Press an ⚡ event he has NO rule for. What does a robot do then?",
    check: (ev) => ev.type === "noMatch",
    reward: "bow",
  },
  {
    id: "fix-it",
    text: (state) => {
      const t = TRIGGERS.find((x) => x.id === state.stumpTrigger);
      return `Fix the bug! Teach Chip a rule for ${t ? `${t.emoji} "${t.label}"` : "the event that confused him"}, then make it happen.`;
    },
    check: (ev, state) => ev.type === "match" && ev.trigger === state.stumpTrigger,
    reward: "party",
  },
  {
    id: "five-rules",
    text: "Rule master! Fill Chip's brain with 5 different rules.",
    check: (ev, state) => state.rules.length >= 5,
    reward: "crown",
  },
  {
    id: "silly",
    text: "Grand finale 🎉 Program Chip to DANCE 🕺 when it RAINS 🌧️ … then make it rain!",
    check: (ev) => ev.type === "match" && ev.trigger === "rain" && ev.action === "dance",
    reward: "rainbow",
  },
];

/* ---------------- State ---------------- */

const SAVE_KEY = "roboRulesSave_v1";

let state = {
  rules: [],            // [{ trigger, action }]
  stars: 0,
  missionIndex: 0,
  unlocked: [],         // accessory ids
  worn: {},             // slot -> accessory id
  stumpTrigger: null,
  muted: false,
};

function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}

/* ---------------- Sound (WebAudio, no files) ---------------- */

let audioCtx = null;
function beep(freq, dur = 0.12, delay = 0, type = "square", vol = 0.08) {
  if (state.muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) {}
}
const sndTap     = () => beep(520, 0.06);
const sndTeach   = () => { beep(392, 0.1); beep(523, 0.1, 0.1); beep(659, 0.18, 0.2); };
const sndMatch   = () => { beep(523, 0.09); beep(659, 0.09, 0.09); beep(784, 0.2, 0.18); };
const sndConfused= () => { beep(330, 0.15, 0, "sawtooth"); beep(247, 0.3, 0.18, "sawtooth"); };
const sndMission = () => { [523,587,659,784,1047].forEach((f,i)=>beep(f,0.12,i*0.1,"triangle",0.1)); };

/* ---------------- DOM helpers ---------------- */

const $ = (id) => document.getElementById(id);
const scene = $("scene"), pet = $("pet"), effects = $("effects");

let selectedWhen = null, selectedThen = null;
let busy = false;
let timers = [];

function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

function showBanner(text, ms = 2600) {
  const b = $("banner");
  b.textContent = text;
  b.classList.remove("hidden");
  later(() => b.classList.add("hidden"), ms);
}

function petSay(text, ms = 2400) {
  const s = $("speech");
  s.textContent = text;
  s.classList.remove("hidden");
  later(() => s.classList.add("hidden"), ms);
}

function burst(emoji, count = 6) {
  const rect = pet.getBoundingClientRect();
  const sceneRect = scene.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "float-emoji";
    el.textContent = emoji;
    el.style.left = (rect.left - sceneRect.left + 20 + Math.random() * 120) + "px";
    el.style.top = (rect.top - sceneRect.top + 40 + Math.random() * 60) + "px";
    el.style.animationDelay = (Math.random() * 0.5) + "s";
    effects.appendChild(el);
    later(() => el.remove(), 2400);
  }
}

function confetti() {
  const emojis = ["🎉","⭐","🎈","✨","🎊"];
  for (let i = 0; i < 26; i++) {
    const el = document.createElement("span");
    el.className = "confetti-bit";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = (Math.random() * 0.8) + "s";
    document.body.appendChild(el);
    later(() => el.remove(), 4200);
  }
}

/* ---------------- Weather / scene ---------------- */

function setSky(kind) {
  scene.className = "sky-" + kind;
  const layer = $("weatherLayer");
  layer.innerHTML = "";
  if (kind === "rain") {
    for (let i = 0; i < 34; i++) {
      const d = document.createElement("span");
      d.className = "raindrop";
      d.style.left = Math.random() * 100 + "%";
      d.style.animationDuration = (0.6 + Math.random() * 0.7) + "s";
      d.style.animationDelay = (Math.random() * 1.5) + "s";
      layer.appendChild(d);
    }
  } else if (kind === "sun") {
    const s = document.createElement("span");
    s.className = "sunburst";
    s.textContent = "☀️";
    layer.appendChild(s);
  }
}

/* ---------------- Pet animation ---------------- */

function setPetAnim(anim) {
  pet.classList.remove("confused","dance","spin","jump","sleep","chase","wiggle","hidden-box");
  $("eyesOpen").style.display = "";
  $("eyesClosed").style.display = "none";
  $("mouthHappy").style.display = "";
  $("mouthFlat").style.display = "none";
  $("propSlot").textContent = "";
  if (!anim) return;
  if (anim === "sleep") {
    $("eyesOpen").style.display = "none";
    $("eyesClosed").style.display = "";
    pet.classList.add("sleep");
  } else if (anim === "confused") {
    $("mouthHappy").style.display = "none";
    $("mouthFlat").style.display = "";
    pet.classList.add("confused");
  } else if (anim === "hide") {
    pet.classList.add("hidden-box");
  } else {
    pet.classList.add(anim);
  }
}

function performAction(action) {
  setPetAnim(action.anim);
  if (action.prop) $("propSlot").textContent = action.prop;
  petSay(action.say);
  burst(action.burst, 7);
  later(() => { setPetAnim(null); renderWorn(); }, 3200);
}

/* ---------------- Rules engine (the heart of the lesson) ---------------- */

function fireEvent(trigger) {
  if (busy) return;
  busy = true;
  clearTimers();
  $("speech").classList.add("hidden");
  sndTap();

  // scene reaction to the event itself
  if (trigger.id === "rain") setSky("rain");
  else if (trigger.id === "sun") setSky("sun");
  else if (trigger.id === "sleepy") setSky("night");
  else setSky("day");

  showBanner(trigger.banner);
  setPetAnim(null);

  later(() => {
    const rule = state.rules.find((r) => r.trigger === trigger.id);
    if (rule) {
      const action = ACTIONS.find((a) => a.id === rule.action);
      sndMatch();
      showBanner(`Rule found! WHEN ${trigger.emoji} THEN ${action.emoji}`, 2800);
      performAction(action);
      onGameEvent({ type: "match", trigger: trigger.id, action: action.id });
    } else {
      sndConfused();
      setPetAnim("confused");
      petSay(`??? I have no rule for ${trigger.emoji} !`, 3000);
      burst("❓", 5);
      state.stumpTrigger = state.stumpTrigger || trigger.id;
      later(() => setPetAnim(null), 3200);
      onGameEvent({ type: "noMatch", trigger: trigger.id });
      save();
    }
    later(() => { busy = false; setSky("day"); }, 3600);
  }, 1200);
}

/* ---------------- Missions & rewards ---------------- */

function currentMission() { return MISSIONS[state.missionIndex] || null; }

function onGameEvent(ev) {
  const m = currentMission();
  if (m && m.check(ev, state)) {
    state.missionIndex++;
    state.stars++;
    if (m.reward && !state.unlocked.includes(m.reward)) {
      state.unlocked.push(m.reward);
      const acc = ACCESSORIES.find((a) => a.id === m.reward);
      state.worn[acc.slot] = acc.id; // auto-wear the new prize
      later(() => showBanner(`🎁 Prize unlocked: ${acc.emoji} ${acc.label}!`, 3200), 3400);
    }
    sndMission();
    confetti();
    $("missionDone").classList.remove("hidden");
    later(() => {
      $("missionDone").classList.add("hidden");
      renderMission();
    }, 2600);
    save();
    renderAll();
  }
}

/* ---------------- Rendering ---------------- */

function renderEventButtons() {
  const wrap = $("eventButtons");
  wrap.innerHTML = "";
  TRIGGERS.forEach((t) => {
    const b = document.createElement("button");
    b.className = "event-btn";
    b.innerHTML = `<span class="big">${t.emoji}</span>${t.label}`;
    b.onclick = () => fireEvent(t);
    wrap.appendChild(b);
  });
}

function renderChoices() {
  const wWrap = $("whenChoices"), tWrap = $("thenChoices");
  wWrap.innerHTML = ""; tWrap.innerHTML = "";
  TRIGGERS.forEach((t) => {
    const b = document.createElement("button");
    b.className = "choice-btn when" + (selectedWhen === t.id ? " selected" : "");
    b.innerHTML = `<span class="big">${t.emoji}</span>${t.label}`;
    b.onclick = () => { sndTap(); selectedWhen = t.id; renderChoices(); };
    wWrap.appendChild(b);
  });
  ACTIONS.forEach((a) => {
    const b = document.createElement("button");
    b.className = "choice-btn then" + (selectedThen === a.id ? " selected" : "");
    b.innerHTML = `<span class="big">${a.emoji}</span>${a.label}`;
    b.onclick = () => { sndTap(); selectedThen = a.id; renderChoices(); };
    tWrap.appendChild(b);
  });

  const prev = $("rulePreview");
  const teach = $("teachBtn");
  if (selectedWhen && selectedThen) {
    const t = TRIGGERS.find((x) => x.id === selectedWhen);
    const a = ACTIONS.find((x) => x.id === selectedThen);
    prev.innerHTML = `WHEN ${t.emoji} <b>${t.label}</b> THEN ${a.emoji} <b>${a.label}</b>`;
    teach.disabled = false;
  } else {
    prev.textContent = "Pick a WHEN and a THEN 👆";
    teach.disabled = true;
  }
}

function renderRules() {
  const list = $("ruleList");
  list.innerHTML = "";
  state.rules.forEach((r, i) => {
    const t = TRIGGERS.find((x) => x.id === r.trigger);
    const a = ACTIONS.find((x) => x.id === r.action);
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="mini-kw mini-when">WHEN</span> ${t.emoji} ${t.label} ` +
      `<span class="mini-kw mini-then">THEN</span> ${a.emoji} ${a.label}`;
    const del = document.createElement("button");
    del.className = "del-btn";
    del.title = "Forget this rule";
    del.textContent = "🗑️";
    del.onclick = () => {
      state.rules.splice(i, 1);
      sndTap();
      petSay("Rule deleted. Forgotten! 🫥");
      save();
      renderRules();
    };
    li.appendChild(del);
    list.appendChild(li);
  });
  $("emptyBrain").classList.toggle("hidden", state.rules.length > 0);
}

function renderMission() {
  const m = currentMission();
  const text = m && (typeof m.text === "function" ? m.text(state) : m.text);
  $("missionText").textContent = m
    ? `Mission ${state.missionIndex + 1} of ${MISSIONS.length}: ${text}`
    : "🏆 ALL missions complete! You're a real programmer. Keep inventing silly rules!";
}

function renderWorn() {
  for (const slot of ["hat", "face", "neck"]) {
    const acc = state.worn[slot] ? ACCESSORIES.find((a) => a.id === state.worn[slot]) : null;
    $(slot + "Slot").textContent = acc ? acc.emoji : "";
  }
}

function renderWardrobe() {
  const panel = $("wardrobePanel");
  const wrap = $("wardrobe");
  if (!state.unlocked.length) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  wrap.innerHTML = "";
  state.unlocked.forEach((id) => {
    const acc = ACCESSORIES.find((a) => a.id === id);
    const worn = state.worn[acc.slot] === acc.id;
    const b = document.createElement("button");
    b.className = "wardrobe-btn" + (worn ? " worn" : "");
    b.innerHTML = `<span class="big">${acc.emoji}</span>${acc.label}`;
    b.onclick = () => {
      state.worn[acc.slot] = worn ? null : acc.id;
      sndTap();
      save();
      renderWorn();
      renderWardrobe();
    };
    wrap.appendChild(b);
  });
}

function renderAll() {
  $("starCount").textContent = "⭐ " + state.stars;
  $("muteBtn").textContent = state.muted ? "🔇" : "🔊";
  renderEventButtons();
  renderChoices();
  renderRules();
  renderMission();
  renderWorn();
  renderWardrobe();
}

/* ---------------- Teach button ---------------- */

$("teachBtn").onclick = () => {
  if (!selectedWhen || !selectedThen) return;
  const existing = state.rules.find((r) => r.trigger === selectedWhen);
  const t = TRIGGERS.find((x) => x.id === selectedWhen);
  const a = ACTIONS.find((x) => x.id === selectedThen);
  if (existing) {
    existing.action = selectedThen;
    petSay(`New rule! I replaced my old ${t.emoji} rule. 🧠`);
  } else {
    state.rules.push({ trigger: selectedWhen, action: selectedThen });
    petSay(`Beep! Rule saved: WHEN ${t.emoji} THEN ${a.emoji}`);
  }
  sndTeach();
  burst("✨", 6);
  pet.classList.add("wiggle");
  later(() => pet.classList.remove("wiggle"), 1900);
  selectedWhen = null;
  selectedThen = null;
  save();
  renderChoices();
  renderRules();
  onGameEvent({ type: "ruleAdded" });
};

$("muteBtn").onclick = () => {
  state.muted = !state.muted;
  $("muteBtn").textContent = state.muted ? "🔇" : "🔊";
  save();
};

/* ---------------- Boot ---------------- */

load();
renderAll();
setSky("day");
later(() => petSay("Hi! I'm Chip 🤖 My brain is empty — teach me rules!", 4200), 800);

// Game Box uses a single service worker at the site root (../sw.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  });
}
