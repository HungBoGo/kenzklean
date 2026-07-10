/**
 * Before/after comparison slider.
 *
 * Deliberately standalone: no GSAP. This is the one piece of motion on the page that is a
 * control rather than decoration, so it must work even if the vendor bundle never loads.
 *
 * Input model, split by pointer type on purpose:
 *   mouse / pen  — drag anywhere on the image. There is nothing to scroll horizontally, and
 *                  hunting for a 44px handle with a mouse is needless precision.
 *   touch        — only the handle drags. Grabbing the whole image would eat the vertical
 *                  swipe the visitor uses to scroll the page past it.
 *   keyboard     — the handle is a real slider: arrows, Home, End, Page keys.
 *
 * The divider position lives in one custom property, `--pos`. Both photographs and both copies
 * of the overlay text clip against it, so the text flips from white to black exactly on the
 * line rather than a frame behind it.
 */
(() => {

const MIN = 2;
const MAX = 98;
const IDLE_BEFORE_AUTO_MS = 2600;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Each slider owns its own position, timers and animation frame. */
function initCompare(root) {
const handle = root.querySelector("[data-compare-handle]");
if (!handle) return;

/**
 * Geometry comes from the photograph, but `--pos` is written to the scope element so that
 * siblings outside the <figure> can clip against it too — the hero headline lives beside the
 * banner, not inside it, because on a phone it drops underneath.
 */
const scope = root.closest("[data-compare-scope]") || root;
const sweep = Number(root.dataset.compareSweep || 26);

let position = 50;
let dragging = false;
let autoFrame = null;
let idleTimer = null;
let visible = false;

function paint(next) {
  position = Math.min(MAX, Math.max(MIN, next));
  scope.style.setProperty("--pos", `${position}%`);
  handle.setAttribute("aria-valuenow", Math.round(position));
}

/* ---------- Idle animation ---------- */

/**
 * A slow sine sweep, so the control announces itself as draggable without a "drag me" nag.
 * Time-based rather than frame-based: it runs at the same speed on a 60Hz and a 144Hz screen.
 */
function autoLoop(startedAt) {
  autoFrame = requestAnimationFrame((now) => {
    const elapsed = (now - startedAt) / 1000;
    paint(50 + Math.sin(elapsed * 0.55) * sweep);
    autoLoop(startedAt);
  });
}

function startAuto() {
  if (autoFrame || dragging || !visible || reducedMotion.matches) return;
  // Phase the sine so it picks up from wherever the visitor let go, with no jump.
  const offset = Math.asin(Math.min(1, Math.max(-1, (position - 50) / sweep))) / 0.55;
  autoLoop(performance.now() - offset * 1000);
}

function stopAuto() {
  if (autoFrame) cancelAnimationFrame(autoFrame);
  autoFrame = null;
}

function scheduleAuto() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(startAuto, IDLE_BEFORE_AUTO_MS);
}

/* ---------- Pointer ---------- */

const positionFromEvent = (event) => {
  const rect = root.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * 100;
};

function beginDrag(event) {
  dragging = true;
  stopAuto();
  clearTimeout(idleTimer);
  root.classList.add("dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  paint(positionFromEvent(event));
}

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  root.classList.remove("dragging");
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  scheduleAuto();
}

// Mouse and pen: the whole image is the target — except over anything you can click.
// The hero carries a booking form; a pointerdown on a <select> must not become a drag.
root.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  if (event.target.closest("a, button:not([data-compare-handle]), input, select, textarea, label")) return;
  event.preventDefault();
  beginDrag(event);
});

// Touch: only the handle, so a vertical swipe over the photo still scrolls the page.
handle.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  beginDrag(event);
});

for (const target of [root, handle]) {
  target.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    event.preventDefault();
    paint(positionFromEvent(event));
  });
  target.addEventListener("pointerup", endDrag);
  target.addEventListener("pointercancel", endDrag);
}

/* ---------- Keyboard ---------- */

const KEY_STEPS = {
  ArrowLeft: -2,
  ArrowRight: 2,
  ArrowDown: -2,
  ArrowUp: 2,
  PageDown: -10,
  PageUp: 10,
};

handle.addEventListener("keydown", (event) => {
  let next = null;

  if (event.key in KEY_STEPS) next = position + KEY_STEPS[event.key];
  else if (event.key === "Home") next = MIN;
  else if (event.key === "End") next = MAX;
  else return;

  event.preventDefault();
  stopAuto();
  clearTimeout(idleTimer);
  paint(next);
  scheduleAuto();
});

handle.addEventListener("focus", stopAuto);
handle.addEventListener("blur", scheduleAuto);

/* ---------- Only animate while on screen ---------- */

if ("IntersectionObserver" in window) {
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      // Sweep the moment it appears. The idle delay exists to stay out of the visitor's way
      // after they have touched it, not to make them wait for the hint in the first place.
      if (visible) startAuto();
      else stopAuto();
    },
    { threshold: 0.35 },
  ).observe(root);
} else {
  visible = true;
  startAuto();
}

// Honour a mid-session change to the motion preference.
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    stopAuto();
    paint(50);
  } else {
    scheduleAuto();
  }
});

paint(Number(root.dataset.compareStart || 50));
}

document.querySelectorAll("[data-compare]").forEach(initCompare);

})();
