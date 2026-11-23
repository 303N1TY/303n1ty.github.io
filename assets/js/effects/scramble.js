/** Decode-style text scramble. Project titles re-decode on hover/focus. */
import { $$, randomChar } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";

const FRAMES = 22;

export function scramble(el, final = el.dataset.text || el.textContent) {
  if (el._scrambling) return;
  el._scrambling = true;
  let f = 0;
  const step = () => {
    el.textContent = [...final]
      .map((c, i) => (c === " " ? " " : i < (f / FRAMES) * final.length ? c : randomChar()))
      .join("");
    if (++f <= FRAMES) requestAnimationFrame(step);
    else { el.textContent = final; el._scrambling = false; }
  };
  step();
}

export function initScramble() {
  if (REDUCED_MOTION) return;
  $$(".work").forEach((a) => {
    const title = a.querySelector(".work__title");
    const run = () => scramble(title);
    a.addEventListener("mouseenter", run);
    a.addEventListener("focus", run);
  });
}
