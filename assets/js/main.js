/**
 * Entry point. Each module owns one feature; this file only wires them together.
 *
 *   core/      helpers, env flags (?shot, reduced motion), i18n, motion stack, scroll engine
 *   effects/   visual effects (WebGL glyph field, reveal, titles, scramble, konami)
 *   sections/  behaviour tied to one part of the page
 *   i18n/      strings (English page copy lives in index.html)
 */
import { $ } from "./core/dom.js";
import { initShotMode } from "./core/env.js";
import { applyLang } from "./core/i18n.js";
import { initMotion } from "./core/motion.js";
import { startScrollEngine } from "./core/scroll.js";

import { initField } from "./effects/field.js";
import { initReveal } from "./effects/reveal.js";
import { initTitles } from "./effects/titles.js";
import { initScramble } from "./effects/scramble.js";
import { initKonami } from "./effects/konami.js";
import { initCursor, initMagnetic } from "./effects/cursor.js";
import { initSound } from "./effects/sound.js";

import { initLoader } from "./sections/loader.js";
import { initNav } from "./sections/nav.js";
import { initCmd } from "./sections/cmd.js";
import { initScenes } from "./sections/scenes.js";
import { initContact } from "./sections/contact.js";
import { initConstruct } from "./sections/construct.js";
import { initCases } from "./sections/case.js";
import { initStack } from "./sections/stack.js";

initShotMode();
applyLang(); // before anything splits or snapshots the copy
$("#year").textContent = new Date().getFullYear();

initMotion();
const startField = initField();
initNav();
initCmd();
initScenes();
initContact();
initConstruct();
initCases();
initStack();
initReveal();
initTitles();
initScramble();
initKonami();
initCursor();
initMagnetic();
initSound();
startScrollEngine();

initLoader(() => startField?.(1600));
