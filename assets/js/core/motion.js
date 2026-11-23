/**
 * Motion stack: GSAP (+ ScrollTrigger, SplitText) and Lenis smooth scroll, loaded as classic
 * scripts from the CDN before main.js. Everything degrades: no CDN → native scroll, no tweens.
 */
import { REDUCED_MOTION } from "./env.js";

export const gsap = window.gsap ?? null;
export let lenis = null;

export function initMotion() {
  if (gsap) gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText].filter(Boolean));
  if (REDUCED_MOTION || !window.Lenis) return;

  lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  window.__lenis = lenis; // tools/drive.ps1 scrolls through it
  if (gsap && window.ScrollTrigger) {
    lenis.on("scroll", window.ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // in-page anchors glide instead of jumping
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    const el = a && a.hash.length > 1 && document.querySelector(a.hash);
    if (!el) return;
    e.preventDefault();
    scrollToTarget(el);
    history.replaceState(null, "", a.hash);
  });
}

/** Scroll to an element or a y offset, smoothly when allowed. */
export function scrollToTarget(target) {
  if (lenis) return lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - (1 - t) ** 4 });
  const behavior = REDUCED_MOTION ? "auto" : "smooth";
  if (typeof target === "number") scrollTo({ top: target, behavior });
  else target.scrollIntoView({ behavior });
}

export const lockScroll = (locked) => lenis?.[locked ? "stop" : "start"]();
