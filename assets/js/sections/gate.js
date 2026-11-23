/**
 * The choice. On a first visit the loader ends on two pills: blue = English, red = Français.
 * Resolves with the picked language once the pick animation has played.
 */
import { $, $$ } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { lang, applyLang } from "../core/i18n.js";

const PICK_MS = 700;

export function askLanguage(loader) {
  const gate = $("#gate");
  const pills = $$(".pill", gate);
  loader.classList.add("is-choosing");
  loader.removeAttribute("aria-hidden");
  gate.hidden = false;
  pills.find((p) => p.dataset.lang === lang)?.focus({ preventScroll: true });

  // the pills drift a little toward the pointer
  const drift = (e) => {
    gate.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
    gate.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
  };
  addEventListener("pointermove", drift);

  return new Promise((resolve) => {
    const pick = (pill) => {
      removeEventListener("pointermove", drift);
      pill.classList.add("is-picked");
      gate.classList.add("is-chosen");
      applyLang(pill.dataset.lang, { persist: true });
      setTimeout(() => resolve(pill.dataset.lang), REDUCED_MOTION ? 0 : PICK_MS);
    };
    pills.forEach((p) => p.addEventListener("click", (e) => { e.stopPropagation(); pick(p); }, { once: true }));
  });
}
