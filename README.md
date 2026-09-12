# Bloxorz+

<img width="1569" height="850" alt="image" src="https://github.com/user-attachments/assets/5c47c8d4-d400-4b8c-9e88-fc32b095c65e" />


Hey — welcome to **Bloxorz+**. It’s the classic Bloxorz you already know (Damien Clarke’s roll-the-block puzzle), with extra ways to play: custom stages, daily and seeded puzzles, gauntlets, themes, color tweaks, and a speedrun timer beside the board.

**[Play it in your browser](https://masterwebx.github.io/bloxorz-plus/)**

## What you can play

- **Classic campaign** — all 33 official stages. Start fresh, resume where you left off, or jump in with a passcode (**Load Stage**).
<img width="1564" height="851" alt="image" src="https://github.com/user-attachments/assets/be6edd75-e61f-446d-8607-58ac0bd8cb65" />

- **Daily puzzle** — one shared remix each UTC day. Same floor for everyone until the clock rolls over.
<img width="1574" height="855" alt="image" src="https://github.com/user-attachments/assets/8096024b-f1a4-49d5-8c9b-018192a453ff" />

- **Seeded puzzles** — pick a seed under **Puzzles** and play that run, or flip on Endless and keep going.
- **Gauntlet** — a multi-stage run. Choose Easy / Medium / Hard / Insane, length 5 / 10 / 15 / 33, and an optional seed.
- **Attract mode** — leave the title screen alone for a bit and it’ll demo a solvable stage. Touch anything to come back.
- **Custom Stages** — build your own floors (pads, bridges, splits), save packs, share codes, and hit **TEST** in the editor to try a draft before you publish it.
<img width="1569" height="856" alt="image" src="https://github.com/user-attachments/assets/0c1a9794-b7fa-4736-bd9d-3094ff811655" />

- **History** — cleared stages show up here so you can replay your saved route.

## Make it yours

- **Customize colors** — turn slots on/off and pick colors for the backdrop, block, stone, exit, switches, fragile tiles, split pads, and bridges. Live preview on the right. Load / save / manage presets, match tiles to the stone color, or reset everything. Backdrop can **Cycle** through hues while you play (the block stays put).
<img width="2174" height="1188" alt="image" src="https://github.com/user-attachments/assets/e2bf5bde-9030-457d-b94b-df60a0bc4a76" />
<img width="1575" height="760" alt="image" src="https://github.com/user-attachments/assets/d920b8a2-c14c-47f9-8f01-9b967182ad5c" />

- **Crop cast** — turn on Cast tab background in Settings, then **Crop cast** and drag on the game screen so your image fills the 550×300 playfield without stretching. You can even cast YouTube videos to have animated backgrounds!
<img width="1554" height="992" alt="castedbg" src="https://github.com/user-attachments/assets/8f072b5d-9ce6-4746-a9bc-ccba58e93c58" />

- **Themes** — Original, Gray, and Holiday ship with the game (custom themes were made by Nathan Spencer). Upload your own zip from Settings. Custom music and sound effects fall back to Original when a clip is missing. GIF and video backgrounds work too.
- **Languages** — switch in Settings. English (Classic) is the default for English browsers; other supported languages pick themselves up when they match your browser.
<img width="1543" height="849" alt="image" src="https://github.com/user-attachments/assets/6b33dfe7-6288-487f-b236-36511d67ebee" />
<img width="1548" height="720" alt="image" src="https://github.com/user-attachments/assets/8323b0ee-a7b2-4a07-816c-4c1e87e21e3b" />

- **Speedrun timer** — optional thin clock on the right of the stage (Settings → Speedrun timer).
<img width="1569" height="861" alt="image" src="https://github.com/user-attachments/assets/2eebebc1-d3d0-4511-8397-23c6976c2057" />

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
