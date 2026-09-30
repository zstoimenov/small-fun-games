/* Comic Studio - the artwork: characters with changeable faces, and scenes.  */
/*                                                                             */
/* Everything is drawn as SVG from code, so a character keeps its look while  */
/* its feelings change, which is the whole trick of drawing comics.           */
/* A character is drawn feet at (0, 0), about 100 units tall.                 */
"use strict";
window.CS = window.CS || {};

CS.Art = (function () {
  const INK = "#1b1b1b";

  CS.FACES = [
    { id: "happy", name: "Happy", e: "😀" }, { id: "sad", name: "Sad", e: "😢" }, { id: "angry", name: "Angry", e: "😠" },
    { id: "scared", name: "Scared", e: "😱" }, { id: "surprised", name: "Surprised", e: "😲" }, { id: "sleepy", name: "Sleepy", e: "😴" }
  ];

  // ── Faces ──────────────────────────────────────────────────────────────────
  // One face for everyone: eyes, eyebrows and a mouth, placed round (0, 0).
  // `g` is the gap between the eyes; features are drawn for the left eye and
  // mirrored, so every face is symmetrical.
  function face(expr, g, eyeCol) {
    const ink = eyeCol || INK, st = `stroke="${ink}" stroke-width="2.6" stroke-linecap="round" fill="none"`;
    const both = (f) => f(-g) + f(g);
    const side = (x) => (x < 0 ? 1 : -1);          // +1 for the left eye
    let eyes = "", brows = "", mouth = "", extra = "";
    switch (expr) {
      case "sad":
        eyes = both((x) => `<circle cx="${x}" cy="0" r="2.6" fill="${ink}"/>`);
        brows = both((x) => `<path d="M${x - 5 * side(x)} -6 L${x + 3 * side(x)} -9.5" ${st}/>`);
        mouth = `<path d="M-6 13 Q0 7 6 13" ${st}/>`;
        extra = `<path d="M${-g} 5 q-2.5 4 0 6 q2.5 -2 0 -6z" fill="#4aa3ff"/>`;
        break;
      case "angry":
        eyes = both((x) => `<circle cx="${x}" cy="1" r="2.6" fill="${ink}"/>`);
        brows = both((x) => `<path d="M${x - 5 * side(x)} -9 L${x + 4 * side(x)} -4.5" ${st} stroke-width="3.2"/>`);
        mouth = `<path d="M-6 12 L-2 10 L2 12 L6 10" ${st}/>`;
        extra = both((x) => `<ellipse cx="${x * 1.9}" cy="7" rx="3.5" ry="2" fill="#ff6b6b" opacity=".6"/>`);
        break;
      case "scared":
        eyes = both((x) => `<circle cx="${x}" cy="0" r="4.6" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="${x}" cy="0.5" r="1.5" fill="${ink}"/>`);
        brows = both((x) => `<path d="M${x - 4 * side(x)} -8 Q${x} -12 ${x + 4 * side(x)} -9" ${st}/>`);
        mouth = `<path d="M-7 12 q1.75 -3 3.5 0 t3.5 0 t3.5 0 t3.5 0" ${st} stroke-width="2"/>`;
        extra = `<path d="M${g * 2.2} -8 q-2.5 4 0 6 q2.5 -2 0 -6z" fill="#8fd0ff"/>`;
        break;
      case "surprised":
        eyes = both((x) => `<circle cx="${x}" cy="0" r="4" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="${x}" cy="0" r="2" fill="${ink}"/>`);
        brows = both((x) => `<path d="M${x - 4 * side(x)} -9 Q${x} -13 ${x + 4 * side(x)} -9" ${st}/>`);
        mouth = `<ellipse cx="0" cy="12" rx="3.6" ry="5" fill="${ink}"/>`;
        break;
      case "sleepy":
        eyes = both((x) => `<path d="M${x - 4} 1 Q${x} 4 ${x + 4} 1" ${st}/>`);
        mouth = `<ellipse cx="0" cy="11" rx="2.4" ry="1.8" fill="${ink}"/>`;
        extra = `<text x="${g + 8}" y="-10" font-size="10" font-weight="900" fill="#5b7bd6" font-family="system-ui,sans-serif">z</text><text x="${g + 14}" y="-17" font-size="8" font-weight="900" fill="#5b7bd6" font-family="system-ui,sans-serif">z</text>`;
        break;
      default: // happy
        eyes = both((x) => `<path d="M${x - 4} 1 Q${x} -4 ${x + 4} 1" ${st}/>`);
        mouth = `<path d="M-7 8 Q0 16 7 8 Z" fill="${ink}"/><path d="M-4 11.5 Q0 14 4 11.5" stroke="#ff8a8a" stroke-width="2" fill="none"/>`;
        extra = both((x) => `<ellipse cx="${x * 1.9}" cy="6" rx="3.2" ry="2" fill="#ff8fa3" opacity=".55"/>`);
    }
    return brows + eyes + mouth + extra;
  }

  // ── Characters ─────────────────────────────────────────────────────────────
  const kid = (shirt, skin, hair, pony) => (f) =>
    `<rect x="-15" y="-14" width="11" height="14" rx="3" fill="#34495e"/><rect x="4" y="-14" width="11" height="14" rx="3" fill="#34495e"/>` +
    `<rect x="-20" y="-46" width="40" height="36" rx="12" fill="${shirt}"/>` +
    `<rect x="-29" y="-44" width="10" height="26" rx="5" fill="${shirt}"/><rect x="19" y="-44" width="10" height="26" rx="5" fill="${skin}" transform="rotate(-12 24 -44)"/>` +
    (pony ? `<circle cx="-24" cy="-76" r="9" fill="${hair}"/>` : "") +
    `<circle cx="0" cy="-68" r="23" fill="${skin}"/>` +
    (pony ? `<path d="M-23 -70 Q-22 -95 0 -93 Q22 -95 23 -70 Q14 -84 0 -80 Q-12 -84 -23 -70Z" fill="${hair}"/>`
      : `<path d="M-23 -70 L-20 -86 L-12 -84 L-8 -95 L0 -88 L8 -96 L12 -85 L20 -88 L23 -70 Q10 -80 -23 -70Z" fill="${hair}"/>`) +
    `<g transform="translate(0 -66)">${f}</g>`;

  CS.CHARS = [
    { id: "sam", name: "Sam", draw: kid("#2a9df4", "#f5c9a0", "#6b3e1d"), g: 8 },
    { id: "mia", name: "Mia", draw: kid("#e9407a", "#c98e62", "#241612", true), g: 8 },
    {
      id: "biscuit", name: "Biscuit", g: 8,
      draw: (f) =>
        `<path d="M28 -30 Q40 -44 36 -52" stroke="#c48a4f" stroke-width="6" stroke-linecap="round" fill="none"/>` +
        `<ellipse cx="4" cy="-26" rx="30" ry="17" fill="#d9a066"/>` +
        [-20, -8, 12, 24].map((x) => `<rect x="${x}" y="-16" width="8" height="16" rx="3" fill="#c48a4f"/>`).join("") +
        `<ellipse cx="-21" cy="-58" rx="8" ry="16" fill="#8a5a2b" transform="rotate(18 -21 -58)"/><ellipse cx="21" cy="-58" rx="8" ry="16" fill="#8a5a2b" transform="rotate(-18 21 -58)"/>` +
        `<circle cx="0" cy="-58" r="21" fill="#d9a066"/><ellipse cx="0" cy="-43" rx="11" ry="7" fill="#f3d2a8"/><ellipse cx="0" cy="-46" rx="4" ry="3" fill="${INK}"/>` +
        `<g transform="translate(0 -67) scale(.8)">${f}</g>`
    },
    {
      id: "bolt", name: "Bolt", g: 9, eye: "#0d2b45",
      draw: (f) =>
        `<rect x="-15" y="-14" width="10" height="14" rx="2" fill="#6f8296"/><rect x="5" y="-14" width="10" height="14" rx="2" fill="#6f8296"/>` +
        `<rect x="-22" y="-46" width="44" height="34" rx="6" fill="#9fb3c8"/><circle cx="0" cy="-30" r="6" fill="#ffd23d" stroke="#6f8296" stroke-width="2"/>` +
        `<line x1="0" y1="-92" x2="0" y2="-104" stroke="#6f8296" stroke-width="3"/><circle cx="0" cy="-106" r="5" fill="#ff5252"/>` +
        `<rect x="-24" y="-92" width="48" height="42" rx="10" fill="#c5d3e0" stroke="#6f8296" stroke-width="2"/>` +
        `<g transform="translate(0 -74)">${f}</g>`
    }
  ];
  const charOf = (id) => CS.CHARS.find((c) => c.id === id) || CS.CHARS[0];
  function char(id, expr) { const c = charOf(id); return c.draw(face(expr, c.g, c.eye)); }

  // ── Scenes (300 x 240) ─────────────────────────────────────────────────────
  const sun = (x, y) => `<circle cx="${x}" cy="${y}" r="18" fill="#ffd23d"/>`;
  const cloud = (x, y) => `<g fill="#fff" opacity=".9"><ellipse cx="${x}" cy="${y}" rx="22" ry="10"/><ellipse cx="${x + 14}" cy="${y - 6}" rx="14" ry="10"/><ellipse cx="${x - 12}" cy="${y - 4}" rx="11" ry="8"/></g>`;
  const pine = (x, h) => `<rect x="${x - 4}" y="${200 - 16}" width="8" height="18" fill="#6b4226"/><polygon points="${x},${200 - h} ${x + 22},${186} ${x - 22},${186}" fill="#2e7d32"/><polygon points="${x},${200 - h - 18} ${x + 16},${200 - h + 22} ${x - 16},${200 - h + 22}" fill="#388e3c"/>`;
  CS.SCENES = [
    { id: "park", name: "Park", e: "🌳", draw: () => `<rect width="300" height="240" fill="#bfe6ff"/>${sun(40, 36)}${cloud(150, 40)}<rect y="172" width="300" height="68" fill="#7cc56b"/><rect x="236" y="110" width="12" height="66" fill="#8d5b34"/><circle cx="242" cy="100" r="34" fill="#3f9b3f"/><circle cx="222" cy="112" r="20" fill="#4caf50"/>` },
    { id: "beach", name: "Beach", e: "🏖️", draw: () => `<rect width="300" height="240" fill="#9fdcff"/>${sun(250, 36)}${cloud(80, 44)}<rect y="140" width="300" height="44" fill="#2e8fd6"/><path d="M0 146 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/><rect y="182" width="300" height="58" fill="#f2d59b"/>` },
    { id: "school", name: "School", e: "🏫", draw: () => `<rect width="300" height="240" fill="#fff1c9"/><rect y="196" width="300" height="44" fill="#c9a36b"/><rect x="60" y="30" width="180" height="92" rx="4" fill="#2f5e3a" stroke="#8d5b34" stroke-width="6"/><path d="M80 60 h60 M80 80 h90 M80 100 h40" stroke="#e8f5e9" stroke-width="3" stroke-linecap="round" opacity=".8"/><circle cx="272" cy="40" r="15" fill="#fff" stroke="#34495e" stroke-width="3"/><path d="M272 40 v-9 M272 40 h7" stroke="#34495e" stroke-width="2.5" stroke-linecap="round"/>` },
    { id: "space", name: "Space", e: "🚀", draw: () => `<rect width="300" height="240" fill="#16163a"/>` + [[20, 30], [70, 80], [120, 20], [180, 60], [260, 25], [230, 110], [40, 130], [150, 120], [280, 150], [100, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join("") + `<circle cx="240" cy="70" r="26" fill="#ff9f43"/><ellipse cx="240" cy="70" rx="42" ry="9" fill="none" stroke="#ffd166" stroke-width="4"/><rect y="200" width="300" height="40" fill="#8e8ea8"/><circle cx="60" cy="215" r="8" fill="#6f6f8a"/><circle cx="200" cy="225" r="11" fill="#6f6f8a"/>` },
    { id: "kitchen", name: "Kitchen", e: "🍳", draw: () => `<rect width="300" height="240" fill="#e7f4f1"/><path d="${Array.from({ length: 10 }, (_, i) => `M${i * 30} 0 v172`).join(" ")} ${Array.from({ length: 6 }, (_, i) => `M0 ${i * 30} h300`).join(" ")}" stroke="#cfe3de" stroke-width="2"/><rect x="190" y="26" width="80" height="60" fill="#bfe6ff" stroke="#fff" stroke-width="6"/><rect y="172" width="300" height="14" fill="#b5835a"/><rect y="186" width="300" height="54" fill="#d8b48a"/><path d="M100 186 v54 M200 186 v54" stroke="#b5835a" stroke-width="3"/>` },
    { id: "forest", name: "Forest", e: "🌲", draw: () => `<rect width="300" height="240" fill="#d3f0d1"/>${cloud(200, 34)}<rect y="186" width="300" height="54" fill="#6aa84f"/>${pine(30, 90)}${pine(90, 70)}${pine(270, 96)}${pine(220, 66)}` }
  ];
  const scene = (id) => (CS.SCENES.find((s) => s.id === id) || CS.SCENES[0]).draw();

  return { char, scene, face, charOf };
})();
