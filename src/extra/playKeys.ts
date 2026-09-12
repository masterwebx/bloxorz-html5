/** CreateJS timeline labels that accept move/swap input (matches pad `game|restart`). */
export function isStagePlayLabel(label: string): boolean {
  return label === "game" || label === "restart";
}

const ACT_TO_CODE: Record<string, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  swap: "Space",
};

/** Direct codes the Coolmath stage still understands without remapping. */
const DIRECT_PLAY_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "Space",
]);

/**
 * Map a keyboard event to the CreateJS code forwarded during stage play.
 * Remapped swap (and dirs) resolve to Arrow codes or Space so the engine path stays stable.
 * Returns null when the key is not a play control.
 */
export function resolveStagePlayCode(evCode: string, act: string | null): string | null {
  if (act && act in ACT_TO_CODE) return ACT_TO_CODE[act];
  const code = evCode === " " ? "Space" : evCode;
  if (DIRECT_PLAY_CODES.has(code)) return code;
  return null;
}
