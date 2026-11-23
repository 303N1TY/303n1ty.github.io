/**
 * FR/EN. English is the page source (index.html); French comes from i18n/fr.js.
 *
 *   data-i18n="key"                      → innerHTML
 *   data-i18n-attr="placeholder:key,…"   → attributes
 *
 * Language resolution: ?lang= > saved choice > none (first visit: the pill gate asks).
 * Modules that rewrite translated DOM (SplitText, manifesto words) hook onBeforeLang/onLang.
 */
import EN from "../i18n/en.js";
import FR from "../i18n/fr.js";

const DICTS = { en: EN, fr: FR };
const SUPPORTED = Object.keys(DICTS);
const valid = (l) => (SUPPORTED.includes(l) ? l : null);

const store = {
  get() { try { return localStorage.getItem("lang"); } catch { return null; } },
  set(v) { try { localStorage.setItem("lang", v); } catch { /* private mode */ } },
};

/** The language is known without asking (URL or a previous visit). */
export const CHOSEN = valid(new URLSearchParams(location.search).get("lang")) || valid(store.get());
export let lang = CHOSEN || (navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en");

const before = [], after = [];
export const onBeforeLang = (fn) => before.push(fn);
export const onLang = (fn) => after.push(fn);

/** A JS-side string in the current language. */
export const t = (key) => DICTS[lang][key] ?? EN[key] ?? key;

const html = new Map(), attrs = new Map();

export function applyLang(next = lang, { persist = false } = {}) {
  const changed = next !== lang;
  if (changed) before.forEach((f) => f(next));
  lang = next;
  if (persist) store.set(lang);
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.desc"));

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (!html.has(el)) html.set(el, el.innerHTML);
    const v = lang === "en" ? html.get(el) : DICTS[lang][el.dataset.i18n];
    el.innerHTML = v ?? html.get(el);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(",").forEach((pair) => {
      const [name, key] = pair.split(":").map((s) => s.trim());
      const id = `${name}|${key}`;
      if (!attrs.has(el)) attrs.set(el, {});
      const src = attrs.get(el);
      if (!(id in src)) src[id] = el.getAttribute(name);
      el.setAttribute(name, (lang === "en" ? src[id] : DICTS[lang][key]) ?? src[id]);
    });
  });
  if (changed) after.forEach((f) => f(lang));
}

export const toggleLang = () => applyLang(lang === "en" ? "fr" : "en", { persist: true });
