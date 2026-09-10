/** Coolmath SoundJS ids / filenames (src/sounds/<id>.mp3). */

export const GAME_SOUND_IDS = [
  "Click",
  "Latch",
  "blox003wav",
  "blox004wav",
  "blox005wav",
  "blox006wav",
  "blox007wav",
  "blox008wav",
  "blox009wav",
  "blox010wav",
  "blox011wav",
  "blox012wav",
  "blox013wav",
  "blox014wav",
  "blox015wav",
  "blox016wav",
  "blox017wav",
  "blox018wav",
  "blox019wav",
  "blox020wav",
  "blox021wav",
  "blox022wav",
  "blox023wav",
  "blox024wav",
  "blox025wav",
  "blox026wav",
  "blox027wav",
  "blox028wav",
  "blox029wav",
  "blox030wav",
  "blox031wav",
  "blox032wav",
  "blox033wav",
  "blox034wav",
  "blox035wav",
  "blox036wav",
  "Music",
  "blox2wav",
  "mech5wav",
  "unsplitwav",
] as const;

export type GameSoundId = (typeof GAME_SOUND_IDS)[number];

export function soundFileForId(id: string): string {
  return `sounds/${id}.mp3`;
}

export function defaultSfxMap(): Record<string, string> {
  const sfx: Record<string, string> = {};
  for (const id of GAME_SOUND_IDS) {
    if (id === "Music") continue;
    sfx[id] = soundFileForId(id);
  }
  return sfx;
}

export function soundIdFromPath(path: string): string | null {
  const base = path.replace(/\\/g, "/").split("/").pop() || "";
  const stem = base.replace(/\.[^.]+$/, "");
  return GAME_SOUND_IDS.includes(stem as GameSoundId) ? stem : null;
}
