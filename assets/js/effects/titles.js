/**
 * Display titles ([data-split]) rise line by line out of a mask when they enter the viewport.
 * SplitText re-splits on resize/font load (autoSplit); a language switch reverts first,
 * then re-splits without replaying titles already seen. Entering titles also trigger a
 * decode sweep in the glyph field behind them (core/decode.js).
 */
import { $$ } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { gsap } from "../core/motion.js";
import { onBeforeLang, onLang } from "../core/i18n.js";
import { decode } from "../core/decode.js";

const seen = new WeakSet();
let splits = [];

function split(el) {
  return window.SplitText.create(el, {
    type: "lines", mask: "lines", linesClass: "line", autoSplit: true,
    onSplit(self) {
      if (seen.has(el)) return;
      return gsap.from(self.lines, {
        yPercent: 115, rotate: 2, duration: 1.3, ease: "expo.out", stagger: 0.09,
        scrollTrigger: { trigger: el, start: "top 88%", once: true, onEnter: () => { seen.add(el); decode(self.masks?.length ? self.masks : self.lines); } },
      });
    },
  });
}

export function initTitles() {
  if (REDUCED_MOTION || !gsap || !window.SplitText || !window.ScrollTrigger) return;
  const els = $$("[data-split]");
  splits = els.map(split);
  onBeforeLang(() => { splits.forEach((s) => s.revert()); splits = []; });
  onLang(() => { splits = els.map(split); });
}
