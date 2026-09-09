# Bloxorz+

This is a **fork** of [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate), renamed to **bloxorz-plus**. Spencer still gets GitHub fork credit.

**Play it:** https://masterwebx.github.io/bloxorz-plus/

Spencer’s repo is the Coolmath **Adobe Animate HTML5** Bloxorz client, plus:

- [Tauri](https://tauri.app/) desktop shell
- In-game timer (speedrun partitions)
- Original / gray / holiday themes

We are adding web extras (player name, Stage Creator, puzzles, history, DEV tools) **on top of that runtime**. The CreateJS game in `src/bloxorz.js` stays the playfield — we do not rewrite the rolling block. See [GAMEPLAN.md](GAMEPLAN.md).

The default app draws its menu as CreateJS text on the same 550×300 stage as the block — their menu sky stays visible, bitmap buttons are hidden. HTML is only used for actual text fields (name, passcode, share code). **Start New Game** still plays in their engine.

Set the name to **DEV** to unlock Dev tools (jump to any campaign stage) and **Beat stage for me** while playing.

Bloxorz was created by Damien Clarke / DX Interactive (21 June 2007). This is an unofficial fan project.

## Run in the browser

```bash
npm install
npm run dev
```

Opens on port **4398**. `npm run build` copies `src` to `dist` (GitHub Pages and Vercel). Push to `master` deploys Pages.

## Desktop (upstream)

```bash
npm install
npm run tauri dev
```

## Version

The main menu shows **v1.0.10** in the bottom-right (from `src/version.js`). Keep that string in sync with `package.json`.

Insane gauntlet and Daily can dump a full 15×10 board. Static stone tiles share one cached bitmap so 150-tile stages stay playable. Dense reverse seeds encode as the compact 75-nibble form; a copied `BXS.` code pastes back as the same stage.

On a phone, turn on **Mobile pad** (the game asks if it thinks you are on a phone). The D-pad appears only while a stage is running. Installed app mode often stays portrait — use **Rotate screen** in Settings or the ROTATE button on the pad to flip the layout to landscape without fighting the phone.

`npm test` runs the TypeScript extra-library tests. `npm run build` bundles `src/extra/` into `extra.bundle.js` and copies `src` to `dist`.
