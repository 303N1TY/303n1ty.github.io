/** Reveal-on-scroll for .reveal, with a per-group stagger and odometer numbers ([data-count]). */
import { $$ } from "../core/dom.js";
import { SHOT, REDUCED_MOTION } from "../core/env.js";

const STAGGER_MS = 80;
const LOOPS = 2; // full 0→9 turns before a digit lands

/**
 * Odometer: every digit becomes a column of 0-9 strips that rolls to its value when revealed;
 * left digits turn longer, like a real counter. The final number stays readable in an sr-only span.
 */
function buildOdometer(el) {
  const digits = String(el.dataset.count).split(""), suffix = el.dataset.suffix || "";
  const strip = Array.from({ length: LOOPS * 10 }, (_, i) => `<i>${i % 10}</i>`).join("");
  // each strip is LOOPS full turns then 0..d; it lands on its last cell (index LOOPS*10 + d)
  const cols = digits.map((d, i) =>
    `<span class="odo__col"><span class="odo__strip" style="--to:${LOOPS * 10 + +d};--i:${i}">${strip}${
      Array.from({ length: +d + 1 }, (_, k) => `<i>${k}</i>`).join("")}</span></span>`).join("");
  el.innerHTML = `<span class="sr-only">${el.dataset.count}${suffix}</span>` +
    `<span class="odo" aria-hidden="true">${cols}${suffix ? `<span class="odo__suffix">${suffix}</span>` : ""}</span>`;
}

export function initReveal() {
  const targets = $$(".reveal");
  // Static end state: content (and final numbers, already in the HTML) is shown as is.
  if (SHOT || REDUCED_MOTION) return targets.forEach((el) => el.classList.add("is-in"));

  $$("[data-count]").forEach(buildOdometer);

  const io = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target: el }) => {
    if (!isIntersecting) return;
    io.unobserve(el);
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) * STAGGER_MS}ms`;
    el.classList.add("is-in");
  }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  targets.forEach((el) => io.observe(el));
}
