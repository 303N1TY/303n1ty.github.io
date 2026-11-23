/**
 * Scroll engine: a single rAF loop drives every scroll-linked effect.
 * Modules register a ticker with onScrollTick((y, velocity) => ...).
 */
import { lerp } from "./dom.js";

const tickers = [];
let lastY = scrollY;

/** Smoothed scroll velocity in px/frame (read by rain, donut, marquees). */
export const scroll = { velocity: 0 };

export const onScrollTick = (fn) => tickers.push(fn);

export function startScrollEngine() {
  const loop = () => {
    const y = scrollY;
    scroll.velocity = lerp(scroll.velocity, y - lastY, 0.2);
    if (Math.abs(scroll.velocity) < 0.01) scroll.velocity = 0;
    lastY = y;
    tickers.forEach((f) => f(y, scroll.velocity));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
