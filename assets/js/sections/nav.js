/** Nav: live path (~/303/<section>), active link, scroll percentage, EN/FR switch. */
import { $, $$ } from "../core/dom.js";
import { onScrollTick } from "../core/scroll.js";
import { lang, onLang, toggleLang } from "../core/i18n.js";

const NAMES = { top: "", manifesto: "", about: "/about", journey: "/journey", skills: "/stack", projects: "/projects", contact: "/contact" };

function initLangToggle() {
  const btn = $("#lang-toggle"), marks = $$("[data-l]", btn);
  const paint = (l) => marks.forEach((m) => m.classList.toggle("is-on", m.dataset.l === l));
  paint(lang);
  onLang(paint);
  btn.addEventListener("click", toggleLang);
}

export function initNav() {
  initLangToggle();
  const path = $("#nav-path"), pct = $("#nav-pct");
  const links = $$(".nav__links a");
  const sections = $$("main section[id]:not([hidden])");
  let current = null, lastPct = -1;

  onScrollTick((y) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.round((y / max) * 100) : 0;
    if (p !== lastPct) { pct.textContent = `${String(p).padStart(3, "0")}%`; lastPct = p; }

    const mark = innerHeight * 0.4;
    const s = sections.findLast((sec) => sec.getBoundingClientRect().top <= mark) || sections[0];
    if (s === current) return;
    current = s;
    path.textContent = NAMES[s.id] ?? `/${s.id}`;
    links.forEach((a) => a.classList.toggle("is-active", a.hash === `#${s.id}`));
  });
}
