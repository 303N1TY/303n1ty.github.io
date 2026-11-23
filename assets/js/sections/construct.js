/**
 * The construct: while a [data-construct] section holds the middle of the viewport,
 * body.is-construct flips the page to ink on white (base/construct.css) and the glyph field follows.
 */
import { $$ } from "../core/dom.js";
import { onScrollTick } from "../core/scroll.js";

export function initConstruct() {
  const zones = $$("[data-construct]");
  if (!zones.length) return;
  let on = null;
  onScrollTick(() => {
    const mid = innerHeight / 2;
    const inside = zones.some((z) => {
      if (z.hidden) return false;
      const r = z.getBoundingClientRect();
      return r.top < mid && r.bottom > mid;
    });
    if (inside === on) return;
    on = inside;
    document.body.classList.toggle("is-construct", inside);
  });
}
