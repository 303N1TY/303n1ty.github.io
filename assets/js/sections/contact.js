/** Contact: a shaded ASCII mug with live steam (leans away from the pointer) + Formspree form submitted without redirect. */
import { $, clamp } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { t } from "../core/i18n.js";

/*
 * The mug is "rendered", not drawn: every character cell is a sample of a small 2D scene with fake 3D
 * lighting (a lit cylinder, an elliptical rim, a torus-ish handle, a swirling coffee surface, a soft
 * shadow), mapped through a brightness ramp. "303" is cut out of the body and wraps with the curvature.
 * Units are em: a JetBrains Mono cell is 0.6em wide and (line-height 1) 1em tall.
 */
const COLS = 44, ROWS = 28, CW = 0.6;
const CX = (COLS * CW) / 2 - 1.4;              // mug axis, nudged left to leave room for the handle
const R = 6.9, RY = 1.6, TOP = 10.6, BOT = 23.6; // body radius, ellipse squash, rim and base heights
const RAMP = " .:-=+*#%@";
const STEAM = " .·:;+*";
const DIGITS = { // 4×5 pixel font, cut out of the body
  3: ["####", "...#", ".###", "...#", "####"],
  0: ["####", "#..#", "#..#", "#..#", "####"],
};
const LABEL = ["3", "0", "3"].map((d) => DIGITS[d]);
const LABEL_ROW = 15; // first row of the label

const L = { x: -0.55, z: 0.83 }; // light from the front-left
const shade = (v) => RAMP[1 + Math.round(clamp(v) * (RAMP.length - 2))];

/** 0 outside the label, 1 on its plate (blank), 2 on a digit stroke. */
function labelHit(x, y) {
  const px = Math.round((x - CX) / CW) + 7, py = Math.floor(y) - LABEL_ROW; // 14 px wide: 3 digits + 2 gaps
  if (px < -1 || px > 14 || py < -1 || py > 5) return 0;
  if (px < 0 || px > 13 || py < 0 || py > 4) return 1;
  const d = Math.floor(px / 5), col = px % 5;
  return col < 4 && LABEL[d][py][col] === "#" ? 2 : 1;
}

function cell(x, y, time, heat) {
  const dx = x - CX;
  const nx = dx / R;
  const inRim = (dx * dx) / (R * R) + ((y - TOP) ** 2) / (RY * RY) <= 1;
  const IR = R - 0.75, IRY = RY - 0.5; // the lip has a visible thickness all round
  const inLiquid = (dx * dx) / (IR * IR) + ((y - TOP) ** 2) / (IRY * IRY) <= 1;

  if (inLiquid) {
    // coffee surface: dark, with a slow swirl and a lighter crema edge
    const u = dx / IR, w = (y - TOP) / IRY;
    const r = Math.hypot(u, w), ang = Math.atan2(w, u);
    const swirl = Math.sin(ang * 2 + r * 5 - time * (0.6 + heat));
    const v = 0.06 + 0.12 * (swirl * 0.5 + 0.5) + (r > 0.82 ? 0.22 : 0);
    return shade(v);
  }
  if (inRim) return shade(y > TOP ? 1 : 0.42); // lip: bright in front, dimmer behind

  const base = BOT + RY * Math.sqrt(Math.max(0, 1 - nx * nx));
  if (Math.abs(nx) < 1 && y > TOP && y < base) {
    const label = labelHit(x, y);
    if (label === 1) return " ";
    const nz = Math.sqrt(1 - nx * nx);
    const lambert = Math.max(0, L.x * nx + L.z * nz);
    const spec = 0.55 * Math.exp(-(((nx + 0.42) / 0.09) ** 2));
    const ao = (y - TOP) / (base - TOP) > 0.85 ? -0.12 : 0;   // a touch darker toward the base
    const v = 0.12 + 0.68 * lambert + spec + ao;
    return label ? "#" : shade(v);
  }

  // handle: a ring on the right side, shaded like a tube
  const hx = CX + R - 0.3, hy = (TOP + BOT) / 2 + 0.6;
  const hd = Math.hypot((x - hx) / 0.8, y - hy);
  if (x > CX + R - 0.6 && hd > 2.6 && hd < 4.4) {
    const tube = (hd - 3.5) / 0.9;                // -1 inner edge … 1 outer edge
    const facing = ((y - hy) / hd) * -0.35 + Math.sqrt(Math.max(0, 1 - tube * tube)) * 0.7;
    return shade(0.08 + facing * 0.7);
  }

  // shadow on the table, pushed right by the light
  const sx = (x - CX - 1.8) / (R + 2.6), sy = (y - BOT - 2.2) / 1.1;
  const s = sx * sx + sy * sy;
  if (s < 1 && y > BOT) return s < 0.45 ? ":" : ".";
  return " ";
}

function steamCell(x, y, time, lean, heat) {
  const h = TOP - RY * 0.4 - y;               // height above the coffee
  if (h <= 0) return 0;
  let d = 0;
  for (let i = 0; i < 3; i++) {
    const xb = CX + (i - 1) * 2.6;
    const c = xb + Math.sin(h * 0.42 - time * 1.25 + i * 2.1) * (0.35 + h * 0.2) + lean * h * h + Math.sin(time * 0.3 + i) * 0.015 * h * h;
    const w = 0.7 + h * 0.11;
    const flicker = 0.55 + 0.45 * Math.sin(h * 1.6 - time * 2.4 + i * 1.7);
    d += Math.exp(-(((x - c) / w) ** 2)) * flicker;
  }
  const rise = Math.min(1, h / 1.6) * Math.max(0, 1 - h / (9 + heat * 3));
  return d * rise * (0.75 + heat * 0.5);
}

function initCoffee() {
  const el = $("#coffee");
  el.innerHTML = `<span class="coffee__steam"></span><span class="coffee__mug"></span>`;
  const steamEl = el.firstElementChild, mugEl = el.lastElementChild;
  let time = 0, lean = 0, leanTo = 0, heat = 0, heatTo = 0, raf = 0, last = 0, visible = false;

  const render = () => {
    const steam = [], mug = [];
    for (let row = 0; row < ROWS; row++) {
      const y = row + 0.5;
      let s = "", m = "";
      for (let col = 0; col < COLS; col++) {
        const x = (col + 0.5) * CW;
        const ch = cell(x, y, time, heat);
        if (ch !== " ") { m += ch; s += " "; continue; }
        const d = steamCell(x, y, time, lean, heat);
        s += STEAM[Math.min(STEAM.length - 1, Math.floor(d * 1.5 * STEAM.length))];
        m += " ";
      }
      steam.push(s); mug.push(m);
    }
    // two layers in the same grid: steam is drawn fainter
    steamEl.textContent = steam.join("\n");
    mugEl.textContent = mug.join("\n");
  };
  render();
  if (REDUCED_MOTION) return;

  // the steam drifts away from the pointer, and a hover warms it up
  addEventListener("pointermove", (e) => {
    if (!visible) return;
    const r = el.getBoundingClientRect();
    const mx = r.left + (CX / (COLS * CW)) * r.width, my = r.top + r.height * 0.3;
    const dx = mx - e.clientX, dist = Math.hypot(dx, my - e.clientY);
    leanTo = clamp(dx / 260, -1, 1) * 0.05 * Math.max(0, 1 - dist / 700);
    heatTo = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom ? 1 : 0;
  }, { passive: true });

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 45) return; // ~22 fps is plenty for ASCII
    time += Math.min(now - last, 100) / 1000 * 1.6;
    last = now;
    lean += (leanTo - lean) * 0.08;
    heat += (heatTo - heat) * 0.06;
    render();
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(el);
}

function initForm() {
  const form = $("#contact-form"), status = $("#form-status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = t("form.sending");
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      status.textContent = t("form.ok");
    } catch {
      status.textContent = t("form.err");
    }
  });
}

export function initContact() {
  initCoffee();
  initForm();
}
