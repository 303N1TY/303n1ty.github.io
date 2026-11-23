/**
 * Runtime environment flags.
 *
 * `?shot` = deterministic capture mode used by tools/shot.ps1:
 * no boot screen, no motion, every reveal shown, and with a #hash
 * only that section is rendered (so headless screenshots don't need to scroll).
 */
export const SHOT = new URLSearchParams(location.search).has("shot");
export const REDUCED_MOTION = SHOT || matchMedia("(prefers-reduced-motion: reduce)").matches;
export const CAN_HOVER = matchMedia("(hover: hover)").matches;

export function initShotMode() {
  if (!SHOT) return;
  document.documentElement.classList.add("shot");
  const id = location.hash.slice(1);
  if (!id || id === "top") return;
  document.querySelectorAll("main section[id]").forEach((s) => {
    if (s.id !== id) s.hidden = true;
  });
}
