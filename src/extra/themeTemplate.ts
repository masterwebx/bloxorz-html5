import { GAME_SOUND_IDS, soundFileForId } from "./sounds";
import { themeAtlasFiles } from "./themeAtlas";
import { zipStore } from "./unzip";

export const TEMPLATE_ZIP_URL = "themes/_template.zip";
export const TEMPLATE_META = ["README.md", "theme.json"] as const;

export type TemplateProgress = (done: number, total: number) => void;

let cachedZip: Uint8Array | null = null;

export function templatePackNames(atlasFiles: string[] = themeAtlasFiles()): string[] {
  const names = new Set<string>(TEMPLATE_META);
  for (const file of atlasFiles) names.add(file.replace(/\\/g, "/"));
  for (const id of GAME_SOUND_IDS) names.add(soundFileForId(id));
  return [...names];
}

export function templateHasArt(names: string[]): boolean {
  const rows = names.map((n) => n.replace(/\\/g, "/"));
  return (
    rows.some((n) => n === "README.md" || n.endsWith("/README.md")) &&
    rows.some((n) => n.startsWith("block/")) &&
    rows.some((n) => n.startsWith("tiles/")) &&
    rows.some((n) => n.startsWith("animations/")) &&
    rows.some((n) => n.startsWith("misc/")) &&
    rows.some((n) => n.startsWith("sounds/"))
  );
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function fetchZipProgress(url: string, onProgress?: TemplateProgress): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const total = Number(res.headers.get("content-length") || 0);
    if (!res.body) {
      const data = new Uint8Array(await res.arrayBuffer());
      onProgress?.(1, 1);
      return data;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        got += value.length;
        onProgress?.(got, total || Math.max(got, 1));
      }
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const chunk of chunks) {
      out.set(chunk, o);
      o += chunk.length;
    }
    onProgress?.(out.length, total || out.length);
    return out;
  } catch {
    return null;
  }
}

async function loadTemplateFile(rel: string): Promise<Uint8Array | null> {
  if (TEMPLATE_META.includes(rel as (typeof TEMPLATE_META)[number])) {
    return fetchBytes(`themes/_template/${rel}`);
  }
  if (rel.startsWith("sounds/")) {
    return (await fetchBytes(`themes/_template/${rel}`)) || (await fetchBytes(rel));
  }
  return (await fetchBytes(`themes/original/${rel}`)) || (await fetchBytes(`themes/_template/${rel}`));
}

export async function assembleThemeTemplate(
  load: (rel: string) => Promise<Uint8Array | null> = loadTemplateFile,
  atlasFiles: string[] = themeAtlasFiles(),
  onProgress?: TemplateProgress,
): Promise<Uint8Array> {
  const names = templatePackNames(atlasFiles);
  const files: { name: string; data: Uint8Array }[] = [];
  let done = 0;
  const total = names.length;
  const results = await Promise.all(
    names.map(async (name) => {
      const data = await load(name);
      done += 1;
      onProgress?.(done, total);
      return data ? { name, data } : null;
    }),
  );
  for (const row of results) {
    if (row) files.push(row);
  }
  if (!templateHasArt(files.map((f) => f.name))) throw new Error("template");
  return zipStore(files);
}

export async function buildThemeTemplateZip(onProgress?: TemplateProgress): Promise<Uint8Array> {
  if (cachedZip) {
    onProgress?.(1, 1);
    return cachedZip;
  }
  const prebuilt = await fetchZipProgress(TEMPLATE_ZIP_URL, onProgress);
  if (prebuilt && prebuilt.length > 64) {
    cachedZip = prebuilt;
    return prebuilt;
  }
  const zip = await assembleThemeTemplate(loadTemplateFile, themeAtlasFiles(), onProgress);
  cachedZip = zip;
  return zip;
}

export function downloadBlob(data: Uint8Array, filename: string): void {
  const blob = new Blob([data as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function setTemplateBusy(on: boolean, ratio = 0, label = ""): void {
  const overlay = document.getElementById("hud-busy");
  const title = document.getElementById("hud-busy-title");
  const bar = document.getElementById("hud-busy-bar");
  document.body.classList.toggle("is-busy", on);
  if (!overlay) return;
  overlay.hidden = !on;
  overlay.setAttribute("aria-hidden", on ? "false" : "true");
  if (title && label) title.textContent = label;
  if (bar) {
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    bar.style.width = `${pct}%`;
  }
}

export async function downloadThemeTemplate(onProgress?: TemplateProgress): Promise<void> {
  const zip = await buildThemeTemplateZip(onProgress);
  downloadBlob(zip, "bloxorz-theme-template.zip");
}
