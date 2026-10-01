# Working in this repo

A launcher page plus one folder per game. Plain HTML/CSS/JS — **no build step, no
dependencies, no framework**. Everything is served as static files from the repo
root by GitHub Pages, so every path must be **relative**.

Planned work and per-game briefs live in [`docs/GAME-ROADMAP.md`](docs/GAME-ROADMAP.md).
Read that before starting a new game.

## Layout

```
index.html      the launcher — shelves, filters, search
games.js        the GAMES catalogue, shared by the launcher and career-compass/
sw.js           ONE service worker for the whole site, launcher and games alike
shared/         screen.css: screen sizes, linked by the launcher and every game
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
3. Catalogue entry in the `GAMES` array in `games.js`. Fields and the
   category list are documented in [`README.md`](README.md#add-a-new-game) —
   `hook` (the one line on the card), `category`, `tags`, `compass`, `players: [min, max]`,
   `age`, `highlights`. **Chips are generated from those fields; never
   hand-write them.** A game with stars also writes
   `gamebox:progress:<folder>` so the home page can show them (README).
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

## Screen sizes

Design for the tablet first, then make it work on a phone held either way and
on a laptop. Link `shared/screen.css` **before** the game's own stylesheet and
put `class="ui-zoom"` on `<html>`:

- Laptops and desktops scale the whole page up (`zoom`), so a tablet layout
  keeps its proportions instead of sitting small in the middle. Size full-height
  layouts with `var(--app-h)`, never `100dvh` (zoom scales vh too). Pointer maths
  that turns screen pixels into page pixels must divide by the body's zoom.
- Phones are never scaled down. Phones held sideways (`max-height:520px`) get a
  tighter layout instead: slim header, board beside its controls (`.ui-split`).
- Tap targets use `var(--tap)`; nothing tappable under 40px, no text under 13px.

`NODE_PATH=$(npm root -g) node tools/screen-check.js [folder ...]` opens pages at
six sizes in both themes, flags those problems and saves a contact sheet.

## Running and checking

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

There is no test suite. Verify changes by driving the real page in a browser —
Chromium and Playwright are available. Check both themes and a phone-width
viewport. `.card{display:flex}` once silently beat the `hidden` attribute, so
confirm behaviour by counting what is actually visible, not by reading the code.
