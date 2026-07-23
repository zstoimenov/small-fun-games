# 🤖 Robo Rules — Teach Chip!

A tiny installable web game (PWA) that introduces kids (~age 8) to the core idea of
programming: **IF this happens, THEN do that.**

Chip the robot pet starts with an **empty brain**. Kids build picture-based rules like
`WHEN 🌧️ it rains THEN ☂️ open umbrella`, then press event buttons to make things
happen in Chip's world:

- If a rule matches → Chip performs the action (dancing, napping, chasing the ball…).
- If no rule matches → Chip is confused! Robots only do what their rules say.
  That's the whole lesson. 🧠

Six guided missions (with prizes: hats, sunglasses, a crown…) walk the kid from
"teach your first rule" to "stump the robot", "fix the bug", and a silly grand finale.
Progress is saved on the device, and it works fully offline once installed.

No build step, no dependencies — plain HTML/CSS/JS.

## Run locally

```bash
cd robo-rules
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `robo-rules`).
2. Push this folder's contents to it:

   ```bash
   cd robo-rules
   git init
   git add .
   git commit -m "Robo Rules PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/robo-rules.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / root → Save**.
4. After a minute the game is live at `https://<your-username>.github.io/robo-rules/`.

All paths in the app are relative, so it works from the `/robo-rules/` subpath out of the box.

## Install on a kid's tablet/phone

Open the GitHub Pages URL, then:

- **Android/Chrome**: tap ⋮ → *Add to Home screen* (or the install prompt).
- **iPad/iPhone (Safari)**: tap Share → *Add to Home Screen*.

It launches full-screen like a real app and works with no internet.

## Reset progress

All progress lives in the browser's localStorage. To start fresh, open the browser
console and run `localStorage.removeItem("roboRulesSave_v1")`, or clear site data.
