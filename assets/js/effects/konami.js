/** ↑↑↓↓←→←→BA toggles the red-pill theme. */
const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function initKonami() {
  let i = 0;
  addEventListener("keydown", (e) => {
    i = e.key === SEQUENCE[i] ? i + 1 : e.key === SEQUENCE[0] ? 1 : 0;
    if (i === SEQUENCE.length) {
      i = 0;
      document.body.classList.toggle("red-pill");
    }
  });
}
