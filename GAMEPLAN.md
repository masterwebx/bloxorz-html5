# Gameplan

Living doc. Update this when a slice lands or the plan changes.

## Repos

| Repo | Role |
| --- | --- |
| [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate) | Upstream. Tauri wrap of Coolmath’s Bloxorz HTML5 export, plus timer and themes. |
| [masterwebx/bloxorz-html5](https://github.com/masterwebx/bloxorz-html5) | **This repo** (renamed fork of Cybernate so it does not share the upstream repo name). GitHub still lists it as a fork of Spencer’s project. Live test: https://masterwebx.github.io/bloxorz-html5/ |
| [masterwebx/web-bloxorz](https://github.com/masterwebx/web-bloxorz) | Earlier canvas remake, frozen at the last good commit before a failed sprite-port. Keep for reference until this fork covers the extras; then retire it. |

Remote `upstream` should stay pointed at Spencer’s repo.

## Credit (do not drop)

- **Damien Clarke / DX Interactive** — original Bloxorz (21 June 2007).
- **Coolmath** — Adobe Animate HTML5 / CreateJS export that is the actual game in `src/bloxorz.js`.
- **Nathan Spencer** — Cybernate: Tauri desktop shell, in-game timer, themes, sound/theme retention.

A GitHub fork credits Spencer in the network graph. README still has to name Clarke and Coolmath.

## Rules

- **CreateJS is the playfield.** Do not reimplement rolls in another renderer.
- **Do not edit** roll / fall / sink / land movieclips in `src/bloxorz.js`.
- Talk to the game from the **outside**: HTML overlays, their tile alphabet (`b s h e v l r k q f`), injected keys on their 36fps ticker.
- Campaign maps come from **their** `src/levels.js`.
- TypeScript we bring over later is a **library** (solver, editor logic, seeds, tests). It does not draw the block.
- Music stays **menu-only**; in-game is clonks.
- Stage size stays **550×300**. Extra UI sits around or over that canvas. Do not stretch the sky.
- Version on the menu reads `window.GAME_VERSION` from `src/version.js`. Keep that in sync with `package.json` (currently **2.0.0**).

## What we are adding (from web-bloxorz)

Not in this first slice. Port in this order:

1. **Playable original in the browser** (Vite) + version on the menu — *current*.
2. **Player chrome** — name → `WEXORZ`-style title, settings, DEV name unlocks extras. Do not replace their bitmap menu; add items or a second screen.
3. **Stage Creator + share seeds** — grid editor, three-click split, beatability badge (does not block Test), `BXS-` / `BXS.` / `BX1.`. Playtest runs inside CreateJS.
4. **Puzzles** — daily / seeded runs; generator + BFS in TS; maps play in their engine.
5. **History, attempts, congrats stats** — replay by feeding a key tape into CreateJS.
6. **DEV** — stage list, Dev Menu, Beat stage for me (including editor playtest).
7. **Gamepad / rumble** — map pad to their keys.

**Deferred:** See ghosts (that overlay was the old renderer). History replay first, ghosts later only if we can draw a second translucent block without touching clips.

## Tests (later)

Keep solver / editor / seed tests as a library. Smoke-test that this bundle still boots. Do not screenshot-test CreateJS frames.

## Done

- [x] Fork `nathan-spencer/bloxorz-cybernate` → renamed **`masterwebx/bloxorz-html5`** (still a GitHub fork)
- [x] Park `web-bloxorz` at the pre-sprite-port commit
- [x] Vite web wrap (`npm run dev` / `npm run build`) without changing `bloxorz.js`
- [x] Version label on the game stage (`v2.0.0`)
- [x] GitHub Pages at https://masterwebx.github.io/bloxorz-html5/
- [x] This file

## Next

- Overlay player name / extra menu entries without replacing CreateJS buttons
- Bring solver + editor over as a library and feed layouts into their level loader
