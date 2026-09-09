# Bloxorz HTML5

This is a **fork** of [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate), renamed to **bloxorz-html5** so it does not share the upstream repo name. Spencer still gets GitHub fork credit.

**Play it:** https://masterwebx.github.io/bloxorz-html5/

Spencer’s repo is the Coolmath **Adobe Animate HTML5** Bloxorz client, plus:

- [Tauri](https://tauri.app/) desktop shell
- In-game timer (speedrun partitions)
- Original / gray / holiday themes

We are adding web extras (player name, Stage Creator, puzzles, history, DEV tools) **on top of that runtime**. The CreateJS game in `src/bloxorz.js` stays the playfield — we do not rewrite the rolling block. See [GAMEPLAN.md](GAMEPLAN.md).

The default **extra** app is its own menu (Orbitron, name → **WEXORZ**, Stage Creator, Puzzles, History, Settings). CreateJS only comes on for the rolling stage. **Legacy mode** reloads the vanilla Coolmath menu if you want that; **EXIT LEGACY MODE** comes back.

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

The main menu shows **v2.3.0** in the bottom-right (from `src/version.js`). Keep that string in sync with `package.json`.

`npm test` runs the TypeScript extra-library tests. `npm run build` bundles `src/extra/` into `extra.bundle.js` and copies `src` to `dist`.
