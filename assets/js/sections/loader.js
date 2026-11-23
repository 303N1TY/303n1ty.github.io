/**
 * Loader: a 0→100 counter, then (first visit only) the pill choice, then a wipe
 * that hands over to the hero intro.
 */
import { $ } from "../core/dom.js";
import { SHOT, REDUCED_MOTION } from "../core/env.js";
import { CHOSEN } from "../core/i18n.js";
import { lockScroll } from "../core/motion.js";
import { askLanguage } from "./gate.js";

const DURATION = 1100;

export function initLoader(onDone) {
  const loader = $("#loader"), count = $("#loader-count"), bar = $("#loader-bar");
  if (SHOT) {
    loader.remove();
    document.body.classList.remove("is-loading");
    return onDone?.();
  }
  lockScroll(true);
  let state = "counting"; // → choosing → done

  const finish = () => {
    if (state === "done") return;
    state = "done";
    document.body.classList.remove("is-loading");
    lockScroll(false);
    loader.classList.add("is-done");
    loader.setAttribute("aria-hidden", "true");
    setTimeout(() => loader.remove(), 1100);
    onDone?.();
  };
  const next = () => {
    if (state !== "counting") return;
    if (CHOSEN) return finish();
    state = "choosing";
    askLanguage(loader).then(finish);
  };

  if (REDUCED_MOTION) {
    count.textContent = "100";
    bar.style.width = "100%";
    return next();
  }

  const t0 = performance.now();
  let fontsOk = false;
  document.fonts.ready.then(() => (fontsOk = true));
  setTimeout(() => (fontsOk = true), 2500); // never hold the site hostage to a font CDN
  const step = (t) => {
    if (state !== "counting") return;
    // ease-out, but hold at 90% until the fonts are in
    let p = Math.min(1, (t - t0) / DURATION);
    p = 1 - (1 - p) ** 3;
    if (!fontsOk) p = Math.min(p, 0.9);
    const n = Math.round(p * 100);
    count.textContent = String(n).padStart(3, "0");
    bar.style.width = `${n}%`;
    if (n < 100) requestAnimationFrame(step);
    else setTimeout(next, 180);
  };
  requestAnimationFrame(step);
  // impatient click skips the count (never the choice)
  loader.addEventListener("click", () => { if (state === "counting") next(); });
}
