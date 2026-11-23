/**
 * Case studies: a project row with data-case="<article id>" opens that article full-screen
 * (the link keeps its external href for no-JS and modified clicks).
 * Same-document View Transition: the row title morphs into the case title, the case rises as a sheet.
 * History-aware: opening pushes #<slug>; Back, Esc and the back buttons close; a deep link opens it.
 */
import { $, $$ } from "../core/dom.js";
import { REDUCED_MOTION } from "../core/env.js";
import { lenis, lockScroll } from "../core/motion.js";

const slug = (article) => article.id.replace(/^case-/, "");

/** Runs update() inside a view transition when possible; returns the transition (or undefined). */
function transition(update, closing = false) {
  if (REDUCED_MOTION || !document.startViewTransition) return void update();
  document.documentElement.classList.toggle("case-closing", closing);
  const vt = document.startViewTransition(update);
  vt.finished.finally(() => document.documentElement.classList.remove("case-closing"));
  return vt;
}

export function initCases() {
  const main = $("main");
  let current = null; // { article, link, title }

  const setOpen = (article, open) => {
    article.hidden = !open;
    main.inert = open;
    lockScroll(open);
    if (!lenis) document.documentElement.style.overflow = open ? "hidden" : ""; // Lenis already locks
  };

  const show = (article, link, animate = true) => {
    if (current) return;
    const title = link.querySelector(".work__title");
    const caseTitle = $(".case__title", article);
    current = { article, link, title };
    title.style.viewTransitionName = "case-title";
    (animate ? transition : (f) => f())(() => {
      title.style.viewTransitionName = "";
      caseTitle.style.viewTransitionName = "case-title";
      setOpen(article, true);
      article.scrollTop = 0;
      $(".case__back", article).focus({ preventScroll: true });
    });
  };

  const hide = () => {
    if (!current) return;
    const { article, link, title } = current;
    const caseTitle = $(".case__title", article);
    current = null;
    const vt = transition(() => {
      setOpen(article, false);
      caseTitle.style.viewTransitionName = "";
      title.style.viewTransitionName = "case-title";
    }, true);
    (vt?.finished ?? Promise.resolve()).then(() => { title.style.viewTransitionName = ""; });
    link.focus({ preventScroll: true });
  };

  $$("[data-case]").forEach((link) => {
    const article = document.getElementById(link.dataset.case);
    if (!article) return;
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // keep "open in new tab"
      e.preventDefault();
      history.pushState({ case: article.id }, "", `#${slug(article)}`);
      show(article, link);
    });
    $$("[data-case-close]", article).forEach((b) => b.addEventListener("click", () => history.back()));
    // deep link (/#wikiboosters): put the page underneath in history so Back closes the case
    if (location.hash === `#${slug(article)}`) {
      history.replaceState(null, "", location.pathname + location.search);
      history.pushState({ case: article.id }, "", `#${slug(article)}`);
      show(article, link, false);
    }
  });

  addEventListener("popstate", () => { if (current) hide(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && current) history.back(); });
}
