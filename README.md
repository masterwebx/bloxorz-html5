# Bloxorz+
<img width="1133" height="765" alt="image" src="https://github.com/user-attachments/assets/9ab02db6-e01f-4428-ae38-9eff7f474d19" />

Fan extras on the Coolmath HTML5 Bloxorz playfield. Same rolling block, plus a Stage Creator, puzzles, history replay, and ghosts.

**Play:** https://masterwebx.github.io/bloxorz-plus/

<!-- Drop screenshots in docs/screenshots/ and uncomment the image tags. -->

## Features

### History replay and ghosts

Finished campaign, custom, daily, seeded, and gauntlet stages land in History. Replay feeds the recorded tape back into the real game. Turn **See ghosts** on to watch earlier winning runs as translucent blocks on the same stage.

<!-- ![History replay](docs/screenshots/history.png) -->

### Stage Creator

Paint a 15×10 stage, link switches to bridges, set split destinations, then Test and Save. Click-drag paints a stroke of tiles. Place a soft or heavy switch and the **Link Switch** tool arms so you can click or drag bridges (click again to cycle On / Off / Toggle).

Full controller support: D-pad moves the cursor, hold Confirm to paint, LB/RB or Q/E change tools, Start tests the stage.

<!-- ![Stage Creator](docs/screenshots/creator.png) -->

### Puzzles

A UTC daily, seeded runs you can share, and a five-stage gauntlet. Daily maps drop switches the solver can ignore.

<!-- ![Puzzles](docs/screenshots/puzzles.png) -->

### Live themes and overlay timer

Original, gray, and holiday themes swap from Settings without restarting. The speedrun timer (off by default) sits over the right edge of the 550×300 stage so the playfield stays full width.

<!-- ![Themes and timer](docs/screenshots/play.png) -->

### On-screen pad

Phones can overlay a D-pad on the stage. **Rotate screen** flips the layout when a standalone install stays portrait.

## Run locally

```bash
npm install
npm run dev
```

Opens on port **4398**. `npm test` runs the TypeScript extras. `npm run build` bundles `src/extra/` into `extra.bundle.js` and copies `src` to `dist`.

### Desktop (upstream Tauri)

```bash
npm install
npm run tauri dev
```

The menu shows **v1.1.0** (from `src/version.js`). Keep that string in sync with `package.json`.

## How it is built

The CreateJS game in `src/bloxorz.js` is the playfield. TypeScript extras in `src/extra/` draw the menu, editor, puzzles, and history on the same 550×300 stage. Campaign maps still come from `src/levels.js`.

This repository is a fork of [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate).

## License

Original extras in `src/extra/` are MIT. See [LICENSE](LICENSE). Bloxorz art, audio, and the Coolmath playfield are **not** covered by that license.

## Credits

- **Damien Clarke / DX Interactive** — Bloxorz, 21 June 2007
- **Coolmath** — Adobe Animate HTML5 / CreateJS export that is the playfield
- **Nathan Spencer** — Cybernate: Tauri desktop shell, speedrun timer, original / gray / holiday themes
- **Bloxorz+** — Stage Creator, puzzles, history replay, ghosts, gamepad menus, live theme swap

Unofficial fan project. Not affiliated with Damien Clarke, DX Interactive, or Coolmath.
