# Bloxorz+

<img width="1133" height="765" alt="Bloxorz+" src="https://github.com/user-attachments/assets/9ab02db6-e01f-4428-ae38-9eff7f474d19" />

The orange block still clonks. The hole is still one tile too far. Then it gets meaner.

This is Coolmath’s HTML5 Bloxorz — Damien Clarke’s puzzle, still rolling in their CreateJS export — with the stuff the Flash days never shipped. A stage painter. A daily that actually makes you use the switches. Ghosts of old lines sliding across the tiles. A speedrun clock that sits on the playfield instead of shoving it aside.

**[Play it](https://masterwebx.github.io/bloxorz-plus/)**

Today’s daily is the same map for everyone. If a switch is on the board, the hole is on the other side of it. Gauntlet does the same thing five times, louder. Paint your own: drop a pad, drag a line of bridges, send the split cubes where you want them. Clear a floor and it lands in History; turn ghosts on and yesterday’s route plays beside you. Themes swap live. The timer, when you want it, is a thin column on the right of the 550×300 stage.

We did not rebuild the roll. We built around it.

A fork of [nathan-spencer/bloxorz-cybernate](https://github.com/nathan-spencer/bloxorz-cybernate). Spencer’s Tauri shell, timer, and themes are why this playfield was here to decorate.

```bash
npm install
npm run dev
```

Browser on port **4398**. `npm test` for the extras. `npm run tauri dev` if you want the desktop wrap. Menu version is **v1.1.1**.

## Credits

- **Damien Clarke / DX Interactive** — Bloxorz, 21 June 2007
- **Coolmath** — the Animate / CreateJS playfield
- **Nathan Spencer** — Cybernate: desktop shell, speedrun timer, original / gray / holiday
- **Bloxorz+** — creator, puzzles, history, ghosts, live themes

MIT on the TypeScript extras in `src/extra/`. The game art, audio, and Coolmath stage are not ours to relicense. Unofficial fan project — not affiliated with Damien, DX, or Coolmath.
