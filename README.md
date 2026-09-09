# Bloxorz+

<img width="1133" height="765" alt="Bloxorz+" src="https://github.com/user-attachments/assets/9ab02db6-e01f-4428-ae38-9eff7f474d19" />

Coolmath’s HTML5 Bloxorz — Damien Clarke’s puzzle, still rolling in their CreateJS export — plus a painter, a daily that remixes the late campaign, ghosts, live themes, and a speedrun clock that sits on the 550×300 stage.

**[Play it](https://masterwebx.github.io/bloxorz-plus/)**

## Features

- **Classic** — all 33 official rooms, passcodes, and the original roll.
- **Daily** — one late-campaign remix for everyone that UTC day (shared bridges, bridges that start on, traps).
- **Gauntlet** — five remixed floors from mid, late, or end-campaign geometry.
- **Paint** — drop a pad, drag bridges, send split cubes where you want them.
- **History** — cleared floors land here; replay the tape.
- **Ghosts** — yesterday’s route plays beside you when the toggle is on.
- **Themes** — drop a folder in `themes/` or upload a zip. Original, Gray, Holiday, and Solid 3D ship in-repo. Custom music and SFX fall back to Original. GIF and video backgrounds are supported. HD atlases use smooth filtering.
- **Languages** — drop a JSON file in `translations/`. English (Classic) is the default for English browsers; other recognized languages switch automatically.
- **Timer** — optional thin column on the right of the stage.

<!-- screenshots
<img alt="Daily" src="docs/daily.png" />
<img alt="Gauntlet" src="docs/gauntlet.png" />
<img alt="Paint" src="docs/paint.png" />
<img alt="Themes" src="docs/themes.png" />
-->

A fork of [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate). Spencer’s Tauri shell, timer, and themes are why this playfield was here to decorate.

```bash
npm install
npm run dev
```

Browser on port **4398**. `npm test` for the extras. `npm run tauri dev` if you want the desktop wrap. Menu version is **v1.2.1**.

Drop-in packs:

- `themes/<id>/theme.json` — see `themes/_template/`
- `translations/<id>.json` — copy `translations/en.json` and translate

## Credits

- **Damien Clarke / DX Interactive** — Bloxorz, 21 June 2007
- **Coolmath** — the Animate / CreateJS playfield
- **Nathan Spencer** — Cybernate: desktop shell, speedrun timer, original / gray / holiday
- **Bloxorz+** — creator, puzzles, history, ghosts, live themes

MIT on the TypeScript extras in `src/extra/`. The game art, audio, and Coolmath stage are not ours to relicense. Unofficial fan project — not affiliated with Damien, DX, or Coolmath.
