import { GAME_SOUND_IDS, soundFileForId } from "./sounds";
import { zipStore } from "./unzip";

const TEMPLATE_META = ["README.md", "theme.json"] as const;

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function buildThemeTemplateZip(): Promise<Uint8Array> {
  const files: { name: string; data: Uint8Array }[] = [];
  for (const name of TEMPLATE_META) {
    const data = await fetchBytes(`themes/_template/${name}`);
    if (data) files.push({ name, data });
  }
  for (const id of GAME_SOUND_IDS) {
    const rel = soundFileForId(id);
    const data = (await fetchBytes(`themes/_template/${rel}`)) || (await fetchBytes(rel));
    if (data) files.push({ name: rel, data });
  }
  if (!files.some((f) => f.name === "README.md")) throw new Error("template");
  if (!files.some((f) => f.name.startsWith("sounds/"))) throw new Error("template-sounds");
  return zipStore(files);
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

export async function downloadThemeTemplate(): Promise<void> {
  const zip = await buildThemeTemplateZip();
  downloadBlob(zip, "bloxorz-theme-template.zip");
}
