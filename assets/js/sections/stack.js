/**
 * Stack: each row's " · " list becomes a full-bleed marquee of huge words.
 * Rows drift in alternating directions; scrolling pushes them (and skews them) with the scroll velocity,
 * hovering a row slows it down. The source <p> stays in the DOM for screen readers and translations.
 * Reduced motion: nothing is built, the static list (skills.css) is the layout.
 */
import { $, $$, clamp, lerp } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { onScrollTick } from "../core/scroll.js";
import { onLang } from "../core/i18n.js";

const BASE = 0.55;   // px per frame at rest
const PUSH = 0.9;    // how much scroll velocity adds
const SKEW_MAX = 8;  // deg

function build(row) {
  const src = $("p", row);
  const items = src.innerHTML.split(/\s*·\s*/).filter(Boolean);
  let mq = $(".mq", row);
  if (!mq) {
    mq = document.createElement("div");
    mq.className = "mq";
    mq.setAttribute("aria-hidden", "true");
    row.append(mq);
  }
  const set = items.map((html, i) =>
    `<span class="mq__item${i % 2 ? " is-outline" : ""}">${html}</span><span class="mq__sep">/</span>`).join("");
  mq.innerHTML = `<div class="mq__track"><div class="mq__set">${set}</div></div>`;
  const track = $(".mq__track", mq), first = $(".mq__set", mq);
  const w = first.offsetWidth || 1;
  const copies = Math.ceil(innerWidth / w) + 1;
  for (let i = 0; i < copies; i++) track.append(first.cloneNode(true));
  return { row, track, width: w, dir: +row.dataset.dir || 1, x: 0, speed: 1, hover: false, visible: false };
}

export function initStack() {
  const stack = $("#stack");
  if (!stack || REDUCED_MOTION) return;
  stack.classList.add("has-mq");

  let rows = [];
  const rebuild = () => {
    const prev = rows;
    rows = $$(".stack__row", stack).map((r, i) => Object.assign(build(r), {
      x: prev[i]?.x ?? 0, hover: prev[i]?.hover ?? false, visible: prev[i]?.visible ?? false,
    }));
    rows.forEach((r) => io.observe(r.row));
  };

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const r = rows.find((x) => x.row === e.target);
    if (r) r.visible = e.isIntersecting;
  }));

  stack.addEventListener("pointerover", (e) => rows.forEach((r) => { r.hover = r.row.contains(e.target); }));
  stack.addEventListener("pointerleave", () => rows.forEach((r) => { r.hover = false; }));

  // fonts change the measured width: build once they are in, rebuild on resize and language switch
  document.fonts.ready.then(rebuild);
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(rebuild, 200); });
  onLang(() => requestAnimationFrame(rebuild));

  let skew = 0;
  onScrollTick((_, vel) => {
    skew = lerp(skew, clamp(-vel * 0.35, -SKEW_MAX, SKEW_MAX), 0.12);
    rows.forEach((r) => {
      if (!r.visible) return;
      r.speed = lerp(r.speed, r.hover ? 0.15 : 1, 0.06);
      r.x -= r.dir * (BASE + Math.abs(vel) * PUSH) * r.speed;
      r.x = ((r.x % r.width) - r.width) % r.width; // keep in (-width, 0]
      r.track.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0) skewX(${(skew * r.dir).toFixed(2)}deg)`;
    });
  });
}
