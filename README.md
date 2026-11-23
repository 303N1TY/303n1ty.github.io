# 303n1ty.github.io

Portfolio of **303**, software engineer. Terminal / Matrix aesthetic, bilingual EN / FR.

**Live:** https://303n1ty.github.io/

Hand-written HTML, CSS and JavaScript. No framework, no build step: what's in the repo is exactly
what GitHub Pages serves. The only third-party code is GSAP (+ ScrollTrigger, SplitText) and Lenis,
loaded from jsDelivr with pinned versions.

## Highlights

- **Pill gate**: red pill / blue pill picks the language (EN / FR) on first visit, remembered afterwards
- **Glyph field**: one fixed WebGL canvas behind the whole page. It spells `303` in ASCII in the hero,
  melts into falling code around the pointer, and "decodes" elements as they appear
- **Scroll**: Lenis smooth scroll, scroll-lit manifesto, journey drawn as a two-branch `git log --graph`
- **Stack**: each row becomes a velocity-driven marquee (skews with scroll speed, slows on hover)
- **Stats**: numbers roll in as odometers
- **The construct**: the projects section flips the whole page to white
- **Case study**: WikiBoosters opens in place with a View Transition, deep-linkable (`#wikiboosters`)
- **Cursor**: a terminal caret that opens into a labelled ring over links; magnetic buttons
- **Sound** (off by default): hum, ticks and blips synthesised live with WebAudio, no audio files
- **Contact**: procedurally shaded ASCII mug whose steam leans away from the pointer; Formspree form
  submitted without reload
- **Command palette** (`/` or Ctrl/⌘+K) and a Konami code easter egg (↑ ↑ ↓ ↓ ← → ← → B A, or `redpill`)
- **404**: "Déjà vu." page with its own rain and a black cat crossing twice
- **Share card**: `assets/img/og.png` (1200×630), rendered from `tools/og.html`
- Respects `prefers-reduced-motion`, keyboard navigable, WCAG AA contrast, WebGL fallback, responsive
- Fonts self-hosted (Clash Display, JetBrains Mono); images in WebP, lazy-loaded

## Project structure

```
index.html                 single page, all English content (French lives in assets/js/i18n/fr.js)
404.html                   self-contained (inline CSS/JS, root-absolute URLs)
assets/
  css/
    main.css               entry point: declares cascade layers, imports the rest
    base/                  tokens, fonts, reset, layout, themes, construct (white theme), utilities
    components/            nav, command palette, loader, gate, button, cursor, case study, field
    sections/              one file per page section
  js/
    main.js                entry point (ES module): wires every feature together
    core/                  DOM/math helpers, environment flags, scroll engine, i18n, decode
    effects/               glyph field, reveal + odometer, scramble, cursor + magnetic, sound, konami
    sections/              gate, loader, nav, command palette, scenes, stack, construct, case, contact
    i18n/                  en.js (JS-only strings), fr.js (all French copy)
  fonts/                   woff2, latin subset
  img/                     logo, og.png, wb/ (WikiBoosters cards, WebP)
tools/
  shot.ps1                 headless screenshots for visual checks
  drive.ps1                drives headless Chrome over CDP for interactive checks
  og.html                  source of the share card
```

### Conventions

- **CSS**: BEM-ish class names (`block__element--modifier`), state classes prefixed with `is-`.
  Everything themable goes through custom properties in `base/tokens.css`. Precedence is handled
  by `@layer` (`tokens → base → layout → components → sections → themes → utilities`), not by specificity.
- **JS**: one feature per module, each exporting an `initX()` function. Scroll-linked effects
  register with `onScrollTick()` so the page runs on a single `requestAnimationFrame` loop.
  Motion is skipped when `REDUCED_MOTION` is set.
- **i18n**: English in the HTML, French in `fr.js` keyed by `data-i18n` / `data-i18n-attr`.

## Run locally

ES modules don't load from `file://` in a normal browser, so serve the folder over HTTP:

```sh
python -m http.server 8000      # or: npx serve .
```

then open http://localhost:8000. (`404.html` and the share card use root-absolute URLs (`/assets/…`),
so they only fully render once deployed.)

## Visual checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/shot.ps1 -All            # every section, 1440 + 500 px
powershell -NoProfile -ExecutionPolicy Bypass -File tools/shot.ps1 -All -Lang fr   # French version
powershell -NoProfile -ExecutionPolicy Bypass -File tools/drive.ps1 -Query "lang=en" -Steps "wait 3000; scroll #contact; wait 2000; shot contact"
```

Shots go to `shots/` (git-ignored). `?shot` in the URL turns on capture mode: no loader, no motion,
all content revealed, and with `#section-id` only that section is rendered.

## Deployment

Pushed to `main` → served by GitHub Pages from the repository root.

## Roadmap

What's left to make the site airtight, by priority.

### 1. Content (needs input from the owner)
- [ ] Case studies for Sortzic and Bavery (screenshots or a short capture), plus image previews that
      follow the cursor over the project list
- [ ] A work project from Leosac / LDA, anonymised if needed (problem → approach → result)
- [ ] Validate the WikiBoosters case study: facts, figures and the owner's exact role

### 2. Robustness
- [ ] Content stays visible without JavaScript: `.reveal` starts at `opacity: 0` unconditionally;
      only hide it once JS has booted (e.g. a `js` class on `<html>`)
- [ ] Contact form: remove `_captcha` (a FormSubmit field, ignored by Formspree), add a `_gotcha`
      honeypot, disable the button while sending
- [ ] `apple-touch-icon`: iOS ignores SVG, ship a 180×180 PNG (plus a PNG favicon fallback)

### 3. Performance & independence
- [ ] Self-host GSAP and Lenis so the page makes no third-party request besides Formspree
- [ ] Lighthouse on the live site; real-device checks on iOS Safari and Firefox
      (View Transitions, WebGL, the field's frame budget on low-end phones)

### 4. Finishing touches
- [ ] Structured data (JSON-LD, handle only)
- [ ] Footer: live local time in Strasbourg; optional "open to opportunities" status
- [ ] Cookie-free analytics (e.g. GoatCounter)
