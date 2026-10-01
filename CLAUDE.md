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
shared/         screen.css: screen-size tokens, linked by the launcher and every game
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

Every game must look designed for the screen it is on: phone held either way,
tablet, laptop, desktop. Link `shared/screen.css` **before** the game's own
stylesheet (it holds `--tap`, `--gutter` and `--app-h`, the window height).

- **Play screens fit the window.** The board, round or studio, its controls and
  the setup sheet are all visible at once: nothing to scroll, nothing that moves
  when text changes. Size the screen to `var(--app-h)`, give the board the
  space that is left (a grid row of `minmax(0,1fr)`; container units against
  the board's aspect ratio when it must keep its shape) and keep the chrome slim.
  Lists that can grow (catalogue, galleries, chapter lists) may scroll.
- **Wider than tall** (`min-aspect-ratio:5/4`: sideways phone, sideways tablet,
  desktop): board on the left at full height, everything to read or tap on the
  right. **Taller than wide:** stacked, board in the middle.
- **Desktop is a full-screen app,** not a scaled-up tablet: the board fills the
  window, panels get desktop-sized type. Never `zoom` the page.
- Phones held sideways (`max-height:520px`) have about 360px of height: header
  into the side column, two-column setup sheets.
- Tap targets use `var(--tap)`; nothing tappable under 40px, no text under 13px.
- **One layout pattern, every screen.** `little-city/` is the reference. Every
  play screen (a level, a studio, a quiz) has the same four parts in the same
  order: the **board**, then a panel of **info** (what's going on), **controls**
  (tools, the talk panel, the verdict) and **actions** (the main buttons, last,
  full width, the main one green). Wider than tall: board left, panel right with
  the actions pinned to its bottom. Taller than wide: info, board, controls,
  actions. Menu screens fill the width the same way. Panel text is left-aligned.
  News and long stories go in the talk panel, not in new boxes that squeeze the
  board. On phones, tools are pictures and picking one names it.

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
