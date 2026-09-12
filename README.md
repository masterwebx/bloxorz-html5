# Bloxorz+

<img width="1569" height="839" alt="image" src="https://github.com/user-attachments/assets/abdecaec-d4ff-4ba2-9f1e-f16a5a36df93" />

Hey — welcome to **Bloxorz+**. It’s the classic Coolmath Bloxorz you already know (Damien Clarke’s roll-the-block puzzle), with extra ways to play: custom stages, daily and seeded puzzles, gauntlets, themes, color tweaks, and a speedrun timer beside the board.

**[Play it in your browser](https://masterwebx.github.io/bloxorz-plus/)**

## What you can play

- **Classic campaign** — all 33 official stages. Start fresh, resume where you left off, or jump in with a passcode (**Load Stage**).
- **Daily puzzle** — one shared remix each UTC day. Same floor for everyone until the clock rolls over.
- **Seeded puzzles** — pick a seed under **Puzzles** and play that run, or flip on Endless and keep going.
- **Gauntlet** — a multi-stage run. Choose Easy / Medium / Hard / Insane, length 5 / 10 / 15 / 33, and an optional seed.
- **Attract mode** — leave the title screen alone for a bit and it’ll demo a solvable stage. Touch anything to come back.
- **Custom Stages** — build your own floors (pads, bridges, splits), save packs, share codes, and hit **TEST** in the editor to try a draft before you publish it.
- **History** — cleared stages show up here so you can replay your saved route.

## Make it yours

- **Customize colors** — turn slots on/off and pick colors for the backdrop, block, stone, exit, switches, fragile tiles, split pads, and bridges. Live preview on the right. Load / save / manage presets, match tiles to the stone color, or reset everything. Backdrop can **Cycle** through hues while you play (the block stays put).
- **Crop cast** — turn on Cast tab background in Settings, then **Crop cast** and drag on the game screen so your image fills the 550×300 playfield without stretching.
- **Themes** — Original, Gray, and Holiday ship with the game. Upload your own zip from Settings (or drop a folder in `themes/` if you’re hacking locally). Custom music and sound effects fall back to Original when a clip is missing. GIF and video backgrounds work too.
- **Languages** — switch in Settings. English (Classic) is the default for English browsers; other supported languages pick themselves up when they match your browser.
- **Speedrun timer** — optional thin clock on the right of the stage (Settings → Speedrun timer).

## Try it locally

```bash
npm install
npm run dev
```

Open the browser on port **4398**. Menu version is **v1.2.5**.

`npm test` runs the extras suite. `npm run tauri dev` wraps the same playfield in a desktop shell.

Building your own packs:

- Themes: `themes/<id>/theme.json` — see `themes/_template/`
- Translations: copy `translations/en.json` and translate

Based on [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate) — Spencer’s desktop shell, timer, and theme work are what this playfield grew from.

## Credits

- **Damien Clarke / DX Interactive** — Bloxorz, 21 June 2007
- **Coolmath** — the Animate / CreateJS playfield
- **Nathan Spencer** — Cybernate: desktop shell, speedrun timer, original / gray / holiday themes
- **Bloxorz+** — custom stages, puzzles, history, themes, color customize, and the rest of the plus features

MIT on the TypeScript extras in `src/extra/`. The game art, audio, and Coolmath stage are not ours to relicense. Unofficial fan project — not affiliated with Damien, DX, or Coolmath.
