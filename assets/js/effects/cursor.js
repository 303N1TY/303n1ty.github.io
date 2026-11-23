/**
 * Cursor: a terminal caret that trails the pointer and blinks when idle.
 * Over something clickable it opens into a ring; [data-cursor] (or a case link / external link) adds a label.
 * Text fields keep the native I-beam, and the native cursor comes back while a modal <dialog> is open
 * (the top layer would cover ours). Fine pointers only, skipped under reduced motion.
 */
import { CAN_HOVER, REDUCED_MOTION } from "../core/env.js";
import { lerp } from "../core/dom.js";
import { t, onLang } from "../core/i18n.js";

const HOT = "a, button, label, summary, select, [role=button], [data-cursor]";
const TEXT = "input:not([type=submit]):not([type=button]), textarea, [contenteditable]";

function labelFor(el) {
  if (el.dataset.cursor != null) return t(el.dataset.cursor);
  if (el.dataset.case) return t("cursor.case");
  if (el.target === "_blank") return "↗";
  return "";
}

export function initCursor() {
  if (!CAN_HOVER || REDUCED_MOTION) return;
  const root = document.documentElement;
  const cur = document.createElement("div");
  cur.className = "cursor";
  cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = `<span class="cursor__ring"></span><span class="cursor__caret"></span><span class="cursor__label"></span>`;
  document.body.append(cur);
  const label = cur.querySelector(".cursor__label");

  let x = -100, y = -100, rx = -100, ry = -100, hot = null, idle;
  const setHot = (el) => {
    if (el === hot) return;
    hot = el;
    const text = el ? labelFor(el) : "";
    if (text) label.textContent = text;
    cur.classList.toggle("is-hot", !!el);
    cur.classList.toggle("has-label", !!text);
  };

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    root.classList.add("has-cursor");
    cur.classList.remove("is-idle");
    clearTimeout(idle);
    idle = setTimeout(() => cur.classList.add("is-idle"), 900);
    evaluate(e.target instanceof Element ? e.target : null);
  }, { passive: true });
  const evaluate = (target) => {
    cur.classList.toggle("is-text", !!target?.closest(TEXT));
    setHot(target?.closest(TEXT) ? null : target?.closest(HOT) ?? null);
  };
  // what's under a still pointer can change (scroll, a case opening, a dialog): look again
  let pending = false;
  const recheck = () => {
    if (pending || x < 0) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; evaluate(document.elementFromPoint(x, y)); });
  };
  addEventListener("scroll", recheck, { passive: true, capture: true });
  addEventListener("click", () => [60, 900].forEach((ms) => setTimeout(recheck, ms)));
  addEventListener("keyup", recheck);
  addEventListener("pointerdown", () => cur.classList.add("is-down"));
  addEventListener("pointerup", () => cur.classList.remove("is-down"));
  document.addEventListener("pointerleave", () => cur.classList.add("is-out"));
  document.addEventListener("pointerenter", () => cur.classList.remove("is-out"));
  onLang(() => { const el = hot; hot = null; setHot(el); });

  const loop = () => {
    rx = lerp(rx, x, 0.18); ry = lerp(ry, y, 0.18);
    cur.style.setProperty("--x", `${x}px`);
    cur.style.setProperty("--y", `${y}px`);
    cur.style.setProperty("--rx", `${rx.toFixed(1)}px`);
    cur.style.setProperty("--ry", `${ry.toFixed(1)}px`);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/**
 * Magnetic: buttons lean toward the pointer while it is near, then spring back with a little overshoot.
 * Driven from JS (individual `translate` property) so it doesn't replace each element's own CSS transitions.
 */
export function initMagnetic(selector = ".btn, .nav__cmd, .nav__lang, .nav__sound, .case__cta, .case__back, .nav__links a") {
  if (!CAN_HOVER || REDUCED_MOTION) return;
  const STRENGTH = 0.3, REACH = 28; // px around the box that already attracts
  const items = [...document.querySelectorAll(selector)].map((el) => ({ el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }));
  let px = -1e4, py = -1e4, running = false;

  const step = () => {
    let moving = false;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      // the untranslated box: remove our own offset so the pull doesn't feed back on itself
      const left = r.left - it.x, top = r.top - it.y;
      const near = r.width > 0 && px > left - REACH && px < left + r.width + REACH && py > top - REACH && py < top + r.height + REACH;
      it.tx = near ? (px - (left + r.width / 2)) * STRENGTH : 0;
      it.ty = near ? (py - (top + r.height / 2)) * STRENGTH : 0;
      // damped spring: snappy toward the pointer, wobbly on release
      it.vx = (it.vx + (it.tx - it.x) * 0.16) * 0.72;
      it.vy = (it.vy + (it.ty - it.y) * 0.16) * 0.72;
      it.x += it.vx; it.y += it.vy;
      if (Math.abs(it.x) + Math.abs(it.y) + Math.abs(it.vx) + Math.abs(it.vy) > 0.05 || near) moving = true;
      else it.x = it.y = it.vx = it.vy = 0;
      it.el.style.translate = it.x || it.y ? `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px` : "";
    }
    running = moving;
    if (moving) requestAnimationFrame(step);
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX; py = e.clientY;
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: true });
  document.addEventListener("pointerleave", () => { px = py = -1e4; });
}
