/**
 * Decode bus: DOM effects announce "this element is materialising now",
 * the glyph field (effects/field.js) answers with a burst of code over its box.
 * No field (no WebGL, reduced motion) → calls are no-ops.
 */
const handlers = [];

export const onDecode = (fn) => handlers.push(fn);

/** @param {Element|Element[]} els boxes to decode (e.g. the lines of a split title) */
export const decode = (els) => handlers.forEach((fn) => fn([].concat(els)));
