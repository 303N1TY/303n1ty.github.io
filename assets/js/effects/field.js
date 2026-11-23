/**
 * The construct: one fixed WebGL glyph field behind the whole page.
 *  - In the hero it spells the name in ASCII; scrolling carries the name up and melts it into code.
 *  - Everywhere, the pointer leaves a decaying trail that reveals the falling code underneath.
 *  - Scrolling fast lets more code bleed through (velocity → rain intensity).
 *  - Elements announced on the decode bus (core/decode.js) get a sweep of glyphs over their box.
 *
 * Inputs to the shader:
 *   uText   — the name rasterised on a 2D canvas (coverage mask), viewport-sized
 *   uTrail  — a small 2D canvas where the pointer paints soft blobs that fade every frame
 *   uDecode — a small 2D canvas redrawn each frame with the active decode sweeps
 *   uAtlas  — one row of glyphs (density ramp + katakana)
 */
import { $ } from "../core/dom.js";
import { SHOT, REDUCED_MOTION } from "../core/env.js";
import { onScrollTick } from "../core/scroll.js";
import { onDecode } from "../core/decode.js";

const RAMP = " .:-=+*#%@";
const KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ012345789Z";
const GLYPHS = RAMP + KANA;
const ATLAS_CELL = 64;
const DECODE_MS = 1100;

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uText, uTrail, uAtlas, uDecode;
uniform vec2 uRes;
uniform float uCell, uTime, uIntro, uScroll, uOffset, uVel, uWhite, uRamp, uGlyphs;
uniform vec3 uColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(frag / uCell);
  vec2 local = fract(frag / uCell);
  vec2 uv = (cell + 0.5) * uCell / uRes;

  float hero = 1.0 - uScroll;                       // 1 in the hero, 0 once it is gone
  float trail = texture2D(uTrail, uv).r * mix(0.45, 1.0, hero);
  float dec = texture2D(uDecode, uv).r;
  float col = hash(vec2(cell.x, 7.0));
  float melt = clamp(trail + uScroll * (0.6 + col * 0.9), 0.0, 1.0);

  // the name rides up with the page; liquid displacement inside the trail
  float n = hash(cell + floor(uTime * 6.0));
  vec2 warp = vec2(sin(uv.y * 40.0 + uTime * 3.0), cos(uv.x * 30.0 + uTime * 2.0)) * 0.012 * trail;
  float mask = texture2D(uText, uv + warp + vec2(0.0, uOffset)).r;

  // falling code columns
  float speed = 0.25 + col * 0.6;
  float drop = fract(cell.y * 0.035 - uTime * speed + col * 10.0);
  float rain = pow(drop, 6.0);
  float kana = uRamp + floor(hash(cell + floor(uTime * 12.0 * (0.3 + col))) * (uGlyphs - uRamp));

  // intro: cells resolve in random order
  float born = step(hash(cell * 1.7), uIntro);

  // a slow diagonal light sweep through the letters drives the density ramp
  float sweep = 0.5 + 0.5 * sin(uv.x * 7.0 - uv.y * 3.0 - uTime * 1.2);
  float lum = mask * (0.55 + 0.45 * sweep);

  float glyph;
  float bright;
  if (melt > 0.05) {
    glyph = kana;
    // full rain while the hero dissolves; afterwards only where the pointer passes
    float rk = clamp(trail * 2.0 + hero, 0.0, 1.0);
    bright = mix(lum, max(rain * 1.2 * rk, lum * 0.5 * (1.0 - melt)), melt);
  } else {
    glyph = lum > 0.03 ? 1.0 + floor(clamp(lum, 0.0, 0.999) * (uRamp - 1.0)) : 0.0;
    bright = lum > 0.03 ? 0.5 + 0.5 * lum : 0.0;
  }

  // the void is never dead: sparse dust, and code that bleeds through when the page moves fast
  float dust = step(0.985, hash(cell + floor(uTime * 1.5))) * 0.16;
  if (bright < dust) { glyph = uRamp + floor(hash(cell * 3.1 + 9.0) * (uGlyphs - uRamp)); bright = dust; }
  float bleed = rain * step(0.7, col) * (0.03 + 0.12 * uVel) * (1.0 - hero);
  if (bright < bleed) { glyph = kana; bright = bleed; }

  // decode sweeps: fast-flickering glyphs, brightest at the sweep front
  if (dec > 0.03) {
    float flick = 0.6 + 0.4 * hash(cell + floor(uTime * 24.0));
    if (dec * flick > bright) { glyph = uRamp + floor(hash(cell + floor(uTime * 30.0)) * (uGlyphs - uRamp)); bright = dec * flick; }
  }

  bright *= born;
  if (uIntro < 1.0 && born > 0.0 && hash(cell + floor(uTime * 20.0)) > uIntro) {
    glyph = uRamp + floor(n * (uGlyphs - uRamp));
  }

  float ink = texture2D(uAtlas, vec2((glyph + local.x) / uGlyphs, local.y)).r;
  vec3 c = mix(uColor, vec3(0.9, 1.0, 0.93), smoothstep(0.85, 1.2, bright) * 0.8);
  // the construct: same glyphs, printed in faint ink on the white void
  vec3 dark = c * ink * bright;
  vec3 light = mix(vec3(0.953, 0.953, 0.937), vec3(0.043, 0.051, 0.047), ink * bright * 0.45);
  gl_FragColor = vec4(mix(dark, light, uWhite), 1.0);
}`;

function makeAtlas() {
  const c = document.createElement("canvas");
  c.width = ATLAS_CELL * GLYPHS.length; c.height = ATLAS_CELL;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `500 ${ATLAS_CELL * 0.78}px "JetBrains Mono", monospace`;
  [...GLYPHS].forEach((ch, i) => g.fillText(ch, (i + 0.5) * ATLAS_CELL, ATLAS_CELL * 0.54));
  return c;
}

function drawName(c, w, h) {
  const scale = Math.min(1, 1400 / w);
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
  const portrait = c.width / c.height < 1;
  const lines = ["303"];
  const font = (s) => `700 ${s}px "Clash Display", "JetBrains Mono", sans-serif`;
  // letters are drawn one by one with tracking, so the glyph cells never weld two letters together
  const TRACK = 0.06; // × font size
  const width = (l, s) => [...l].reduce((w, ch) => w + g.measureText(ch).width, 0) + TRACK * s * (l.length - 1);
  g.font = font(100);
  const widest = Math.max(...lines.map((l) => width(l, 100)));
  let size = (c.width * 0.9 / widest) * 100;
  size = Math.min(size, c.height * (portrait ? 0.3 : 0.52));
  g.font = font(size);
  g.filter = `blur(${Math.max(2, size * 0.022)}px)`; // soft edges → the ramp gets a gradient
  const lineH = size * 0.9;
  const total = lineH * lines.length;
  const top = c.height * 0.47 - total / 2;
  lines.forEach((l, i) => {
    let x = (c.width - width(l, size)) / 2;
    const y = top + lineH * (i + 1) - size * 0.08;
    for (const ch of l) {
      g.fillText(ch, x, y);
      x += g.measureText(ch).width + TRACK * size;
    }
  });
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function texture(gl, unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function upload(gl, unit, tex, source) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

/** Returns a start(introMs) function, or null when WebGL is unavailable. */
export function initField() {
  const canvas = $("#field"), hero = $("#top");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: SHOT });
  if (!gl) return null;

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn("[field]", e);
    return null;
  }
  gl.useProgram(prog);
  document.documentElement.classList.add("has-field");

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const names = ["uText", "uTrail", "uAtlas", "uDecode", "uRes", "uCell", "uTime", "uIntro", "uScroll", "uOffset", "uVel", "uWhite", "uRamp", "uGlyphs", "uColor"];
  const U = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform1i(U.uText, 0); gl.uniform1i(U.uTrail, 1); gl.uniform1i(U.uAtlas, 2); gl.uniform1i(U.uDecode, 3);
  gl.uniform1f(U.uRamp, RAMP.length); gl.uniform1f(U.uGlyphs, GLYPHS.length);

  const texName = texture(gl, 0), texTrail = texture(gl, 1), texAtlas = texture(gl, 2), texDecode = texture(gl, 3);
  const nameCanvas = document.createElement("canvas");
  const small = () => { const c = document.createElement("canvas"); c.width = 160; c.height = 100; return [c, c.getContext("2d")]; };
  const [trail, tg] = small();
  const [decodeCanvas, dg] = small();
  dg.fillRect(0, 0, 160, 100); tg.fillRect(0, 0, 160, 100); // start black (default fill is black)

  let vw = innerWidth, vh = innerHeight;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    vw = innerWidth; vh = innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uCell, Math.round((vw < 700 ? 9 : 12) * dpr));
    drawName(nameCanvas, vw, vh);
    upload(gl, 0, texName, nameCanvas);
    trail.height = decodeCanvas.height = Math.round(trail.width * vh / vw);
    tg.fillStyle = "#000"; tg.fillRect(0, 0, trail.width, trail.height);
    if (REDUCED_MOTION && booted) draw(performance.now());
  };

  const color = () => {
    const rgb = getComputedStyle(document.body).getPropertyValue("--g-rgb").split(",").map((v) => +v / 255);
    gl.uniform3f(U.uColor, rgb[0], rgb[1], rgb[2]);
    if (REDUCED_MOTION && booted) draw(performance.now());
  };

  // pointer → trail (the canvas is the viewport, so client coords map directly)
  const pointer = { x: -1, y: -1, px: -1, py: -1, active: false };
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / vw * trail.width;
    pointer.y = e.clientY / vh * trail.height;
    pointer.active = true;
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer.active = false; pointer.px = -1; });

  const paintTrail = () => {
    tg.globalCompositeOperation = "source-over";
    tg.fillStyle = "rgba(0,0,0,0.045)";
    tg.fillRect(0, 0, trail.width, trail.height);
    if (!pointer.active) return;
    tg.globalCompositeOperation = "lighter";
    const steps = pointer.px < 0 ? 1 : Math.max(1, Math.ceil(Math.hypot(pointer.x - pointer.px, pointer.y - pointer.py) / 2));
    for (let i = 1; i <= steps; i++) {
      const x = pointer.px < 0 ? pointer.x : pointer.px + (pointer.x - pointer.px) * i / steps;
      const y = pointer.py < 0 ? pointer.y : pointer.py + (pointer.y - pointer.py) * i / steps;
      const r = trail.width * 0.07;
      const grad = tg.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.22)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      tg.fillStyle = grad;
      tg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    pointer.px = pointer.x; pointer.py = pointer.y;
  };

  // decode sweeps: boxes stored in page coordinates, a glowing band crosses each one left → right
  let sweeps = [];
  onDecode((els) => {
    if (REDUCED_MOTION) return;
    const t = performance.now();
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) sweeps.push({ x: r.left, y: r.top + scrollY, w: r.width, h: r.height, t0: t + i * 90 });
    });
  });
  const paintDecode = (now) => {
    dg.fillStyle = "#000"; dg.fillRect(0, 0, decodeCanvas.width, decodeCanvas.height);
    sweeps = sweeps.filter((s) => now - s.t0 < DECODE_MS);
    const sx = decodeCanvas.width / vw, sy = decodeCanvas.height / vh;
    for (const s of sweeps) {
      const p = (now - s.t0) / DECODE_MS;
      if (p < 0) continue;
      const x = s.x * sx, y = (s.y - scrollY) * sy, w = s.w * sx, h = s.h * sy;
      const front = x + w * 1.4 * (1 - (1 - p) ** 2) - w * 0.2;
      const band = w * 0.45;
      const grad = dg.createLinearGradient(front - band, 0, front, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, `rgba(255,255,255,${(1 - p * 0.5).toFixed(3)})`);
      dg.fillStyle = grad;
      const l = Math.max(x, front - band), r = Math.min(x + w, front);
      if (r > l) dg.fillRect(l, y, r - l, h);
    }
  };

  // hero → name offset (in viewport heights) and melt amount
  let offset = 0, scrollP = 0, vel = 0;
  onScrollTick((y, v) => {
    const before = offset;
    if (hero.hidden) { offset = 2; scrollP = 1; } // ?shot#section: no hero on the page
    else {
      const top = hero.getBoundingClientRect().top;
      offset = -top / vh;
      scrollP = Math.min(1, Math.max(0, -top / hero.offsetHeight));
    }
    vel += (Math.min(1, Math.abs(v) / 60) - vel) * 0.15;
    // reduced motion: no loop, but the name must still follow the page
    if (REDUCED_MOTION && booted && offset !== before) draw(performance.now());
  });

  let intro = SHOT || REDUCED_MOTION ? 1 : 0, introStart = 0, introMs = 1, booted = false;
  let white = 0; // eases towards body.is-construct (sections/construct.js)
  const t0 = performance.now();

  function draw(now) {
    if (introStart && intro < 1) intro = Math.min(1, (now - introStart) / introMs);
    if (!REDUCED_MOTION) {
      paintTrail();
      upload(gl, 1, texTrail, trail);
      paintDecode(now);
      upload(gl, 3, texDecode, decodeCanvas);
    }
    gl.uniform1f(U.uTime, REDUCED_MOTION ? 0 : (now - t0) / 1000);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uScroll, REDUCED_MOTION && !hero.hidden ? 0 : scrollP);
    gl.uniform1f(U.uOffset, offset);
    gl.uniform1f(U.uVel, REDUCED_MOTION ? 0 : vel);
    const target = document.body.classList.contains("is-construct") ? 1 : 0;
    white = REDUCED_MOTION || Math.abs(target - white) < 0.002 ? target : white + (target - white) * 0.07;
    gl.uniform1f(U.uWhite, white);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // nothing to draw while a case study covers the page: skip the GPU work, keep the loop alive
  const covered = () => document.querySelector(".case:not([hidden])") && !document.documentElement.classList.contains("case-closing");
  const frame = (now) => { if (!covered()) draw(now); requestAnimationFrame(frame); };

  const boot = () => {
    upload(gl, 2, texAtlas, makeAtlas());
    for (const [unit, tex, c] of [[1, texTrail, trail], [3, texDecode, decodeCanvas]]) upload(gl, unit, tex, c);
    booted = true;
    resize(); color();
    addEventListener("resize", resize);
    new MutationObserver(color).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    if (REDUCED_MOTION) draw(performance.now());
    else requestAnimationFrame(frame);
  };
  const ready = document.fonts.load('700 100px "Clash Display"').then(() => document.fonts.load('500 40px "JetBrains Mono"')).catch(() => {}).then(boot);

  return (ms) => ready.then(() => { introMs = ms; introStart = performance.now(); });
}
