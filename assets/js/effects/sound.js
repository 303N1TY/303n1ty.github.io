/**
 * Sound: off by default, toggled from the nav (or `sound` in the command palette), remembered per browser.
 * Everything is synthesised with WebAudio (no files): a low construct hum, a tick on hover, a blip on click.
 * The AudioContext is only created on the first toggle, which is a user gesture (autoplay rules).
 */
import { $ } from "../core/dom.js";
import { CAN_HOVER } from "../core/env.js";

const KEY = "sound";
const HOT = "a, button, [role=button], [data-cursor], .pill";
const store = {
  get() { try { return localStorage.getItem(KEY) === "on"; } catch { return false; } },
  set(v) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* private mode */ } },
};

let ctx = null, master = null, on = false, button = null;

function boot() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // hum: two detuned low sines through a slowly breathing low-pass, very quiet
  const hum = ctx.createGain(); hum.gain.value = 0.05;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220; lp.Q.value = 6;
  [55, 55.4, 110.3].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i === 2 ? "triangle" : "sine"; o.frequency.value = f;
    o.connect(lp); o.start();
  });
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = 0.07; depth.gain.value = 120;
  lfo.connect(depth).connect(lp.frequency); lfo.start();
  lp.connect(hum).connect(master);
}

/** A short enveloped tone. */
function blip(freq, { dur = 0.05, type = "square", gain = 0.035, to = freq } = {}) {
  if (!on || !ctx) return;
  const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export const sfx = {
  tick: () => blip(2600, { dur: 0.025, type: "sine", gain: 0.03 }),
  click: () => { blip(880, { dur: 0.06, to: 440 }); },
  open: () => blip(180, { dur: 0.5, type: "sawtooth", gain: 0.04, to: 900 }),
};

export function setSound(next) {
  on = next;
  store.set(on);
  if (on) { boot(); ctx.resume(); }
  if (ctx) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.25);
  button?.setAttribute("aria-pressed", String(on));
  document.documentElement.classList.toggle("sound-on", on);
  if (on) sfx.click();
  return on;
}
export const toggleSound = () => setSound(!on);

export function initSound() {
  button = $("#sound-toggle");
  button?.addEventListener("click", toggleSound);
  // a remembered "on" can't start audio before a gesture: arm it for the first click/key anywhere
  if (store.get()) {
    const arm = (e) => {
      if (e.target instanceof Element && e.target.closest("#sound-toggle")) return; // its own click decides
      removeEventListener("pointerdown", arm, true); removeEventListener("keydown", arm, true); if (!on) setSound(true); };
    addEventListener("pointerdown", arm, true);
    addEventListener("keydown", arm, true);
    button?.setAttribute("aria-pressed", "true");
  }

  let last = null;
  if (CAN_HOVER) document.addEventListener("pointerover", (e) => {
    const hot = e.target instanceof Element ? e.target.closest(HOT) : null;
    if (hot && hot !== last) sfx.tick();
    last = hot;
  });
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element) || e.target.closest("#sound-toggle")) return;
    if (e.target.closest("[data-case]")) sfx.open();
    else if (e.target.closest(HOT)) sfx.click();
  });
}
