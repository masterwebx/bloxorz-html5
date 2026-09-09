# Theme pack

Copy this folder, rename it, and drop it in `themes/`. The game lists every folder here that has a `theme.json` (this `_template` folder is skipped).

## theme.json

| Field | Notes |
| --- | --- |
| `id` | Folder name, used in Settings |
| `name` | Label in the theme dropdown |
| `atlas` | PNG spritesheet in this folder (builtin packs use `atlas.png`). Same sprite layout as Original. Leave empty to keep the current atlas. |
| `atlasScale` | `2` if the PNG is 2× the original sheet (HD). |
| `hd` | Smooth filtering instead of nearest-neighbor. |
| `render` | `atlas` (default) or `solid3d` (isometric cubes for tiles, pieces, and the block). |
| `paint` | Menu ink colors. Missing keys fall back to Original. |
| `background.type` | `sky` (in-game sky), `image`, `gif`, or `video`. |
| `background.src` | File in this folder for image / gif / video. |
| `audio.music` | Looping music file. Missing → Original music. |
| `audio.sfx` | Map of Coolmath sound ids (`Click`, `Latch`, `Music`, `blox003wav`…) to files in this folder. Missing ids use Original. |

Zip the folder (theme.json at the root or one level down) and upload it from Settings.
