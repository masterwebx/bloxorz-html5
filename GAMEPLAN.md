# Gameplan

Living doc. Update this when a slice lands or the plan changes.

## Repos

| Repo | Role |
| --- | --- |
| [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate) | Upstream. Tauri wrap of Coolmath’s Bloxorz HTML5 export, plus timer and themes. |
| [masterwebx/bloxorz-html5](https://github.com/masterwebx/bloxorz-html5) | **This repo** (renamed fork of Cybernate so it does not share the upstream repo name). GitHub still lists it as a fork of Spencer’s project. Live test: https://masterwebx.github.io/bloxorz-html5/ |
| [masterwebx/web-bloxorz](https://github.com/masterwebx/web-bloxorz) | Earlier canvas remake, frozen at the last good commit before a failed sprite-port. Keep for reference. |

Remote `upstream` should stay pointed at Spencer’s repo.

## Credit (do not drop)

- **Damien Clarke / DX Interactive** — original Bloxorz (21 June 2007).
- **Coolmath** — Adobe Animate HTML5 / CreateJS export that is the actual game in `src/bloxorz.js`.
- **Nathan Spencer** — Cybernate: Tauri desktop shell, in-game timer, themes, sound/theme retention.

## Rules

- **CreateJS is the playfield.** Do not reimplement rolls in another renderer.
- **Do not edit** roll / fall / sink / land movieclips in `src/bloxorz.js`.
- Talk to the game from the **outside**: HTML overlays (`src/extra/`), their tile alphabet (`b s h e v l r k q f`), injected keys via `stage.triggerKeyDown`.
- Campaign maps come from **their** `src/levels.js`. Custom / puzzle maps are converted and returned from a wrapped `getLevels()`.
- TypeScript in `src/extra/` is the solver, editor, seeds, generator, history. It does not draw the block.
- Music stays **menu-only**; in-game is clonks.
- Stage size stays **550×300**. Extra UI sits over that canvas.
- Version on the menu reads `window.GAME_VERSION` from `src/version.js` (**2.2.0**), bottom-right.

## Play modes

`localStorage` `bloxorz-play-mode`:

- **Extra** (default) — HTML overlay on the CreateJS main menu. Vanilla bitmap buttons are hidden and driven from the overlay. Name → `NAMEORZ`. **Legacy mode** reloads vanilla.
- **Legacy** — vanilla Cybernate. **EXIT LEGACY MODE** at the bottom of the main menu reloads extra.

## What shipped

1. Playable original in the browser (Vite) + version on the menu.
2. Player chrome — extra overlay, name, settings, rumble, legacy mode.
3. Stage Creator + `BXS-` / `BXS.` / `BX1.` share codes. Test play runs inside CreateJS. Save after a successful test. Beatability badge does not block Test.
4. Puzzles — daily (UTC date + difficulty) and seeded runs (1 / 5 / 10). Generator + BFS in TS; maps play in CreateJS.
5. History — campaign runs stored locally; replay feeds a key tape into CreateJS.
6. DEV — name the player `DEV` to unlock Dev tools (stage list) and an in-game **Beat stage for me**.
7. Gamepad — D-pad / left stick rolls, X swap, Start pause, rumble on fall (toggle in Settings).

**Deferred:** See ghosts.

## Tests

`npm test` runs the extra-library tests (editor / seeds). Do not screenshot-test CreateJS frames.
