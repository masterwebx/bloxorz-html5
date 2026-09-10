# Theme pack

This zip is a starting theme. Unzip it, rename the folder, replace the art and sounds, then zip it again (keep `theme.json` at the root or one folder down) and upload it from Settings → **Upload theme**.

The `_template` folder in the repo is skipped by the game list so it never shows up as a playable theme.

## What to edit

| Path | What it is |
| --- | --- |
| `theme.json` | Id, name, paint colors, background, and sound map |
| `sounds/` | **Every** in-game clip, not only music. Same filenames the game already loads |
| `block/` | The rust block: `movement.png` is the roll strip. Land, fall, split, shrink, and shadows live here too |
| `animations/` | Door open/close frames (`bolckadoor…`) |
| `tiles/` | Floor, metal, switches, exit |
| `misc/` | Menu chrome, numbers, win art — **not** block frames |
| `backgrounds/` | Sky / menu art |
| `tutorial/` | How-to pictures |

Copy missing PNGs from `themes/original/` if you only want to recolor a few tiles. Missing files fall back to Original.

## Sounds

Put replacements in `sounds/` using these **exact** names (Coolmath SoundJS ids):

- `Music.mp3` — looping menu / stage music (the game keeps this off during a stage)
- `Click.mp3`, `Latch.mp3` — menus
- `blox003wav.mp3` … `blox036wav.mp3` — block rolls and related hits
- `blox2wav.mp3`, `mech5wav.mp3`, `unsplitwav.mp3`

`theme.json` already maps each id to `sounds/<id>.mp3`. Delete a mapping (or the file) to keep the Original clip.

## Block folders (do not duplicate frames)

Older packs split the block across `block/`, `animations/`, and `misc/`. That overlap is gone:

- **`block/movement.png`** — standing / rolling frames (`blocka0000`–`blocka0120`) as one strip
- **`block/*.png`** — `blockafall`, `blockaland`, `blockashadow`, `blockasmall`, `blockashrink`, and their shadows
- **`animations/`** — only the **door** clips (`bolckadoor`, `bolckadoorr`)
- **`misc/`** — UI and labels, not the block

Do not keep the same fall frame in both `animations/` and `misc/`. The atlas loader reads the path in `theme.json`’s matching original layout (see `src/extra/atlasMap.json`).

## theme.json fields

| Field | Notes |
| --- | --- |
| `id` | Folder name, used in Settings |
| `name` | Label in the theme dropdown |
| `atlas` | Optional packed sheet. Leave empty to compose from the folders above |
| `atlasScale` | `2` if the PNG is 2× the original sheet (HD) |
| `hd` | Smooth filtering instead of nearest-neighbor |
| `render` | `atlas` (default) or `solid3d` |
| `paint` | Menu ink colors. Missing keys fall back to Original |
| `background.type` | `sky`, `image`, `gif`, or `video` |
| `background.src` | File in this folder for image / gif / video |
| `audio.music` | Looping music file (`sounds/Music.mp3`) |
| `audio.sfx` | Map of sound ids to files in `sounds/` |

Zip the folder and upload it from Settings.
