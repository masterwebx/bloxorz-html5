"""Slice theme atlases into editable folders and pack them back.

Coolmath logo frames are dropped. Missing files fall back to Original.
Packed folder files are what the game loads at runtime.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BLOX = ROOT / "src" / "bloxorz.js"
THEMES = ROOT / "themes"
MAP_PATH = ROOT / "src" / "extra" / "atlasMap.json"

TILES = {
    "blip",
    "hardswitch_v3",
    "softswitch_v3",
    "splitswitch_v2",
    "stone2_v2",
    "stone3_v2",
    "stoneexit_v2",
    "metal_v2",
    "metal_v3",
}
BACKGROUNDS = {"bettersky_22", "menuw"}
SKIP = {"CoolmathGames800x480"}


def parse_frames(src: str) -> list[tuple[int, int, int, int]]:
    m = re.search(r"frames:\s*\[(.*?)\],\s*\}\s*,\s*\];", src, re.S)
    if not m:
        raise SystemExit("frames not found")
    return [tuple(int(n) for n in g) for g in re.findall(r"\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]", m.group(1))]


def parse_sprites(src: str) -> list[tuple[str, int]]:
    return re.findall(r"\(lib\.(\w+)\s*=\s*function\s*\(\)\s*\{[^}]*gotoAndStop\((\d+)\)", src)


def folder_for(name: str) -> str | None:
    if name in SKIP:
        return None
    if name in BACKGROUNDS:
        return "backgrounds"
    if re.fullmatch(r"blocka\d{4}", name):
        return "block"
    if name.startswith("blockafall") or name.startswith("bolckadoor"):
        return "animations"
    if name.startswith("instrucpict"):
        return "tutorial"
    if name in TILES:
        return "tiles"
    return "misc"


def crop(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = box
    return img.crop((x, y, x + w, y + h))


def build_map() -> dict:
    src = BLOX.read_text(encoding="utf-8")
    frames = parse_frames(src)
    sprites = parse_sprites(src)
    by_i = {int(i): name for name, i in sprites}
    rows = []
    block_n = 0
    for i, box in enumerate(frames):
        name = by_i.get(i, f"frame_{i}")
        folder = folder_for(name)
        row = {
            "name": name,
            "i": i,
            "x": box[0],
            "y": box[1],
            "w": box[2],
            "h": box[3],
            "folder": folder,
            "file": None if folder is None else ("block/movement.png" if folder == "block" else f"{folder}/{name}.png"),
        }
        if folder == "block":
            row["srcX"] = block_n * box[2]
            row["srcY"] = 0
            block_n += 1
        rows.append(row)
    orig_atlas = open_rgba(THEMES / "original" / "atlas.png")
    if orig_atlas:
        width, height = orig_atlas.size
        orig_atlas.close()
    elif MAP_PATH.exists():
        prev = json.loads(MAP_PATH.read_text(encoding="utf-8"))
        width, height = int(prev.get("width") or 4096), int(prev.get("height") or 4096)
    else:
        width, height = 4096, 4096
    payload = {"width": width, "height": height, "frames": rows}
    MAP_PATH.write_text(json.dumps(payload) + "\n", encoding="utf-8")
    return payload


def slice_theme(theme: str, payload: dict) -> None:
    atlas = THEMES / theme / "atlas.png"
    if not atlas.exists():
        print("skip slice", theme)
        return
    img = Image.open(atlas).convert("RGBA")
    out_root = THEMES / theme
    for name in ("backgrounds", "block", "animations", "tutorial", "tiles", "misc"):
        (out_root / name).mkdir(parents=True, exist_ok=True)

    strip_frames = [row for row in payload["frames"] if row["folder"] == "block"]
    strip_frames.sort(key=lambda r: r["i"])
    if strip_frames:
        w, h = strip_frames[0]["w"], strip_frames[0]["h"]
        strip = Image.new("RGBA", (w * len(strip_frames), h))
        for n, row in enumerate(strip_frames):
            strip.paste(crop(img, (row["x"], row["y"], row["w"], row["h"])), (n * w, 0))
        strip.save(out_root / "block" / "movement.png")

    written = set()
    for row in payload["frames"]:
        folder = row["folder"]
        if folder is None or folder == "block":
            continue
        dest = out_root / folder / f"{row['name']}.png"
        if dest.name in written:
            continue
        crop(img, (row["x"], row["y"], row["w"], row["h"])).save(dest)
        written.add(dest.name)
    print("sliced", theme, len(written) + (1 if strip_frames else 0))


def open_rgba(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGBA")


def pack_theme(theme: str, payload: dict, original_parts: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGBA", (payload["width"], payload["height"]), (0, 0, 0, 0))
    orig_atlas = open_rgba(THEMES / "original" / "atlas.png")
    if orig_atlas:
        sheet.paste(orig_atlas, (0, 0))
    theme_root = THEMES / theme
    movement = open_rgba(theme_root / "block" / "movement.png")
    orig_move = original_parts.get("block/movement.png")
    for row in payload["frames"]:
        x, y, w, h = row["x"], row["y"], row["w"], row["h"]
        if row["folder"] is None:
            sheet.paste((0, 0, 0, 0), (x, y, x + w, y + h))
            continue
        part = None
        if row["folder"] == "block":
            src = movement or orig_move
            if src:
                sx = int(row.get("srcX") or 0)
                part = src.crop((sx, 0, sx + w, h))
        else:
            local = open_rgba(theme_root / row["file"])
            part = local or original_parts.get(row["file"])
        if part:
            if part.size != (w, h):
                part = part.resize((w, h), Image.Resampling.NEAREST)
            sheet.paste(part, (x, y), part)
    dest = theme_root / "atlas.png"
    sheet.save(dest, optimize=True)
    print("packed", theme, dest.stat().st_size)


def load_original_parts(payload: dict) -> dict[str, Image.Image]:
    out: dict[str, Image.Image] = {}
    root = THEMES / "original"
    move = open_rgba(root / "block" / "movement.png")
    if move:
        out["block/movement.png"] = move
    for row in payload["frames"]:
        if not row["file"] or row["folder"] == "block":
            continue
        img = open_rgba(root / row["file"])
        if img:
            out[row["file"]] = img
    return out


def main() -> None:
    payload = build_map()
    for theme in ("original", "gray", "holiday", "solid3d"):
        slice_theme(theme, payload)
    print("wrote", MAP_PATH)


if __name__ == "__main__":
    main()
