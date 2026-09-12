# Bloxorz+

<img width="1569" height="839" alt="image" src="https://github.com/user-attachments/assets/abdecaec-d4ff-4ba2-9f1e-f16a5a36df93" />


Coolmath’s HTML5 Bloxorz — Damien Clarke’s puzzle, still rolling in their CreateJS export — plus a stage creator, daily and seeded remixes, gauntlets, live themes, color customize, and a speedrun clock that sits on the 550×300 stage.

**[Play it](https://masterwebx.github.io/bloxorz-plus/)**

## Features

- **Classic** — all 33 official rooms, passcodes, and the original roll (Start / Resume / Load Stage).
- **Daily** — one late-campaign remix for everyone that UTC day (shared bridges, bridges that start on, traps).
- **Seeded** — play or endless-run from a seed under Puzzles.
- **Gauntlet** — Easy / Medium / Hard / Insane; lengths 5 / 10 / 15 / 33; optional seed. Generative floors prefer planning over long ON-only island chains.
- **Attract** — idle on the home menu long enough and the title demos a solvable stage (any input returns home).
- **Custom Stages** — paint pads, bridges, splits; manage packs and enter codes. Editor **TEST** plays the draft and returns to edit.
- **History** — cleared floors land here; replay the saved tape.
- **Customize colors** — per-slot On/Off swatches (backdrop, block, stone, exit, switches, fragile, split, bridges), live preview, **Load preset** / save / manage, **Tiles match stone**, **Reset all**. Backdrop **Cycle ON/OFF** shifts hue continuously (not the block).
- **Crop cast** — with Cast tab background on, drag a crop on the game screen (fills 550×300, no stretch).
- **Themes** — drop a folder in `themes/` or upload a zip. Original, Gray, and Holiday ship in-repo. Custom music and SFX fall back to Original. GIF and video backgrounds are supported. HD atlases use smooth filtering.
- **Languages** — drop a JSON file in `translations/`. English (Classic) is the default for English browsers; other recognized languages switch automatically.
- **Timer** — optional thin column on the right of the stage (Settings → Speedrun timer).

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

Browser on port **4398**. `npm test` for the extras. `npm run tauri dev` if you want the desktop wrap. Menu version is **v1.2.5**.

Drop-in packs:

- `themes/<id>/theme.json` — see `themes/_template/`
- `translations/<id>.json` — copy `translations/en.json` and translate

## Credits

- **Damien Clarke / DX Interactive** — Bloxorz, 21 June 2007
- **Coolmath** — the Animate / CreateJS playfield
- **Nathan Spencer** — Cybernate: desktop shell, speedrun timer, original / gray / holiday
- **Bloxorz+** — creator, puzzles, history, themes, color customize

MIT on the TypeScript extras in `src/extra/`. The game art, audio, and Coolmath stage are not ours to relicense. Unofficial fan project — not affiliated with Damien, DX, or Coolmath.
