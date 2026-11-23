/** Scroll-driven scenes: manifesto word lighting, git graph drawing. */
import { $, $$, clamp } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { onScrollTick } from "../core/scroll.js";
import { onLang } from "../core/i18n.js";

/** Wrap every word of the manifesto in a span; words inside <em> are keywords. Whitespace is kept as is. */
function splitWords(text) {
  const words = [];
  const out = [...text.childNodes].flatMap((node) => {
    const key = node.nodeName === "EM";
    return node.textContent.split(/(\s+)/).filter(Boolean).map((tok) => {
      if (/^\s+$/.test(tok)) return document.createTextNode(tok);
      const span = document.createElement("span");
      span.className = key ? "w is-key" : "w";
      span.textContent = tok;
      words.push(span);
      return span;
    });
  });
  text.replaceChildren(...out);
  return words;
}

function initManifesto() {
  const section = $("#manifesto"), text = $("#manifesto-text");
  let words = splitWords(text);
  let lit = -1;
  onLang(() => {
    words = splitWords(text);
    lit = -1;
    if (REDUCED_MOTION) words.forEach((w) => w.classList.add("is-lit"));
  });

  if (REDUCED_MOTION) return words.forEach((w) => w.classList.add("is-lit"));
  onScrollTick(() => {
    const r = section.getBoundingClientRect();
    const n = Math.round(clamp((-r.top / (r.height - innerHeight)) * 1.2) * words.length);
    if (n === lit) return;
    lit = n;
    words.forEach((w, i) => w.classList.toggle("is-lit", i < n));
  });
}

function initGraph() {
  const graph = $("#graph"), commits = $$(".commit", graph);
  if (REDUCED_MOTION) return commits.forEach((c) => c.classList.add("is-passed"));
  onScrollTick(() => {
    const r = graph.getBoundingClientRect(), mark = innerHeight * 0.65;
    graph.style.setProperty("--fill", clamp((mark - r.top) / r.height).toFixed(4));
    commits.forEach((c) => c.classList.toggle("is-passed", c.getBoundingClientRect().top + 38 < mark));
  });
}

export function initScenes() {
  initManifesto();
  initGraph();
}
