/* Design Studio - colour maths: mixing paint, telling colours apart,          */
/* readability, and warm versus cool. No DOM here, so tools/ can run it.       */
"use strict";
window.DS = window.DS || {};

DS.Colour = (function () {
  // ── Mixing paint ───────────────────────────────────────────────────────────
  // Screens mix light (red + green = yellow), but kids learn the painter's
  // rules: red, yellow and blue, with red + yellow = orange. So paint is mixed
  // in RYB and turned into screen colour through the corners of an RYB cube
  // (Gossett & Chen, "Paint Inspired Color Mixing and Compositing", 2004).
  const CUBE = {
    "000": [1, 1, 1], "100": [1, 0, 0], "010": [1, 1, 0], "001": [0.163, 0.373, 0.6],
    "110": [1, 0.5, 0], "101": [0.5, 0, 0.5], "011": [0, 0.66, 0.2], "111": [0.2, 0.094, 0]
  };
  function ryb2rgb(r, y, b) {
    const out = [0, 0, 0];
    for (const k in CUBE) {
      const w = (k[0] === "1" ? r : 1 - r) * (k[1] === "1" ? y : 1 - y) * (k[2] === "1" ? b : 1 - b);
      CUBE[k].forEach((v, i) => { out[i] += w * v; });
    }
    return out;
  }

  // The paints, and a pot of drops { red, yellow, blue, white, black } -> hex.
  // Only the ratio matters: 2 red + 1 yellow is the same as 4 red + 2 yellow.
  // Black counts double, because a little black paint goes a long way.
  const PAINTS = [
    { id: "red", name: "Red", hex: "#e32b2b" },
    { id: "yellow", name: "Yellow", hex: "#ffe12e" },
    { id: "blue", name: "Blue", hex: "#2a5fd0" },
    { id: "white", name: "White", hex: "#ffffff" },
    { id: "black", name: "Black", hex: "#1d1d1f" }
  ];
  function mix(pot) {
    const r = pot.red || 0, y = pot.yellow || 0, b = pot.blue || 0, w = pot.white || 0, k = (pot.black || 0) * 2;
    const hue = r + y + b, total = hue + w + k;
    if (!total) return null;
    const top = Math.max(r, y, b) || 1;
    const c = hue ? ryb2rgb(r / top, y / top, b / top) : [0, 0, 0];
    const rgb = c.map((v, i) => (v * hue + 1 * w + 0.06 * k) / total);
    return hex(rgb.map((v) => v * 255));
  }
  const drops = (pot) => Object.values(pot).reduce((n, v) => n + v, 0);

  // ── Converting ─────────────────────────────────────────────────────────────
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = (rgb) => "#" + rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  // How different two colours look to a person (CIE76 delta E in Lab).
  // Around 2 is barely visible. The mixing levels accept under 5: close
  // recipes like 3 red + 2 yellow against 2 + 1 land about 8 apart.
  function lab(h) {
    const lin = rgb(h).map((v) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; });
    const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
    const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
    const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function distance(a, b) {
    const p = lab(a), q = lab(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  // ── Can you read it? ───────────────────────────────────────────────────────
  // The contrast ratio web designers use (WCAG): 1 is invisible, 21 is black
  // on white. 4.5 is the grown-up rule for text; big titles can manage on 3.
  function luminance(h) {
    const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // ── Warm, cool, light, dark ────────────────────────────────────────────────
  function hsl(h) {
    const [r, g, b] = rgb(h).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
    return [hue, s, l];
  }
  // Reds, oranges, yellows and pinks are warm; greens, blues and purples
  // cool. Greys, black and white are neither, and yellow-greens sit on the
  // fence, so the levels never ask about those.
  function temp(h) {
    const [hue, s, l] = hsl(h);
    if (s < 0.2 || l < 0.1 || l > 0.95) return "neutral";
    if (hue < 70 || hue > 315) return "warm";
    if (hue >= 90 && hue <= 315) return "cool";
    return "neutral";
  }
  const light = (h) => luminance(h) > 0.45;
  const dark = (h) => luminance(h) < 0.12;

  return { PAINTS, mix, drops, hex, rgb, distance, contrast, luminance, hsl, temp, light, dark };
})();

// The ready-made colours for posters. Kids add their own mixed paints to these.
DS.PALETTE = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00897b", "#29b6f6", "#1e5bd8", "#1a237e",
  "#8e24aa", "#ec407a", "#795548", "#fff3d6", "#ffffff", "#9e9e9e", "#212121"];
