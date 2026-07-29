# Working in this repo

A launcher page plus one folder per game. Plain HTML/CSS/JS — **no build step, no
dependencies, no framework**. Everything is served as static files from the repo
root by GitHub Pages, so every path must be **relative**.

Planned work and per-game briefs live in [`docs/GAME-ROADMAP.md`](docs/GAME-ROADMAP.md).
Read that before starting a new game.

## Layout

```
index.html      the launcher — the GAMES catalogue and the filter bar live here
sw.js           ONE service worker for the whole site, launcher and games alike
<game>/         one folder per game
docs/           planning notes
```

Small games are a single `index.html` (see `afl-goal-kick/`). Anything bigger
splits out, and that is the convention to follow for new games:

```
<game>/index.html
<game>/css/style.css
<game>/js/*.js          one file per concern — rules.js, ai.js, ui.js, app.js
<game>/icons/
<game>/manifest.webmanifest
```

`yatzy-dice/` is the reference implementation for a large game: rules, AI,
audio, UI and app state in separate files.

## Adding a game — the checklist

1. Folder with `index.html`, relative paths throughout.
2. Back link to the launcher: `<a href="../">&lsaquo; Games</a>`.
3. Catalogue entry in the root `index.html` `GAMES` array. Fields and the
   category list are documented in [`README.md`](README.md#add-a-new-game) —
   `category`, `players: [min, max]`, `age`, `highlights`. **Card chips are
   generated from those fields; never hand-write them.**
4. Register the shared worker: `navigator.serviceWorker.register('../sw.js')`.
   Do not add a per-game service worker — the two that used to exist are now
   self-unregistering stubs.
5. Add every file to the `ASSETS` list in `sw.js`, and bump the `CACHE` version
   string.

## House style

- **Theme-aware.** Support light and dark: `@media (prefers-color-scheme: dark)`
  *and* `:root[data-theme="dark"]` / `[data-theme="light"]` overrides.
- **Tablet-first.** These are played on a kid's tablet. Big tap targets,
  `viewport-fit=cover` plus `env(safe-area-inset-*)` padding,
  `touch-action:manipulation`, `-webkit-tap-highlight-color:transparent`.
- **Kid-readable copy.** Short sentences, no jargon, in the blurbs and in-game.
- Comments explain *why*, not what. Match the density of the file you're in.

## Running and checking

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

There is no test suite. Verify changes by driving the real page in a browser —
Chromium and Playwright are available. Check both themes and a phone-width
viewport. `.card{display:flex}` once silently beat the `hidden` attribute, so
confirm behaviour by counting what is actually visible, not by reading the code.
