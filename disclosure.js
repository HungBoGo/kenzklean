/**
 * Smooth, exclusive <details> groups.
 *
 * `<details>` snaps. Browsers are only now growing `::details-content` plus `interpolate-size`,
 * and neither is safe to rely on yet, so the height is animated here with the Web Animations API:
 * the element stays a real <details>, keyboard and screen readers keep working, and a failed
 * script leaves ordinary click-to-toggle panels behind.
 *
 * Inside a `[data-accordion]` only one panel is open at a time, and a click anywhere outside the
 * group closes it.
 */
(() => {

const DURATION = 340;
const EASING = "cubic-bezier(0.22, 0.7, 0.24, 1)";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One in-flight animation per <details>; a fast double-click must not stack them. */
const running = new WeakMap();

/**
 * The closed height is the summary plus whatever box the <details> puts around it. Measuring the
 * summary alone left the panel's own padding out and the animation ended a dozen pixels short,
 * clipping the border.
 */
function closedHeight(details) {
  const cs = getComputedStyle(details);
  const summary = details.querySelector("summary");
  return (
    summary.offsetHeight +
    parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) +
    parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth)
  );
}

function animate(details, from, to, onFinish) {
  running.get(details)?.cancel();

  details.style.overflow = "hidden";
  const animation = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: DURATION, easing: EASING });
  running.set(details, animation);

  animation.onfinish = () => {
    running.delete(details);
    details.style.overflow = "";
    details.style.height = "";
    onFinish?.();
  };
  animation.oncancel = () => {
    details.style.overflow = "";
    details.style.height = "";
  };
}

function open(details) {
  if (details.open) return;

  if (reduced()) {
    details.open = true;
    return;
  }

  const start = closedHeight(details);
  details.open = true; // The panel must be open before its full height can be measured.
  animate(details, start, details.offsetHeight);
}

function close(details) {
  if (!details.open) return;

  if (reduced()) {
    details.open = false;
    return;
  }

  // Stays open while it shrinks; only then does `open` flip, so nothing pops.
  animate(details, details.offsetHeight, closedHeight(details), () => {
    details.open = false;
  });
}

/* ---------- Wiring ---------- */

const groups = [...document.querySelectorAll("[data-accordion]")];
if (!groups.length) return;

const panelsIn = (group) => [...group.querySelectorAll("details")];

groups.forEach((group) => {
  panelsIn(group).forEach((details) => {
    const summary = details.querySelector("summary");

    summary.addEventListener("click", (event) => {
      // The browser would toggle `open` for us, instantly. We take it over.
      event.preventDefault();

      if (details.open) {
        close(details);
        return;
      }

      panelsIn(group).forEach((other) => other !== details && close(other));
      open(details);
    });
  });
});

// A click outside a group folds it away. Clicks on links inside are left alone: they navigate.
document.addEventListener("pointerdown", (event) => {
  groups.forEach((group) => {
    if (group.contains(event.target)) return;
    panelsIn(group).forEach(close);
  });
});

// Escape closes whichever group holds focus.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const group = event.target.closest?.("[data-accordion]");
  if (!group) return;

  const openPanel = panelsIn(group).find((d) => d.open);
  if (!openPanel) return;

  close(openPanel);
  openPanel.querySelector("summary").focus();
});

})();
