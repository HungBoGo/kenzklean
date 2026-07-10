/**
 * Horizontal rails.
 *
 * On a phone, four guarantee badges and five process steps stack into 1.6 screens of scrolling
 * before the page has said anything. Laid on their side they cost one card each, and the overflow
 * is its own affordance: a card peeking off the right edge says "there is more" better than any
 * arrow does.
 *
 * The CSS does all of the scrolling — these are ordinary `overflow-x: auto` scroll containers with
 * snap points, so they swipe, they keyboard-scroll, and they work with this file deleted.
 *
 * This file adds one thing: `[data-rail-auto]` drifts to the next card on its own.
 *
 *   - Only the guarantee badges get it. They are four short phrases nobody reads in order. The
 *     five process steps are numbered instructions, and moving the page under someone counting
 *     "step 1, step 2" is a way to lose them.
 *   - It pauses the moment a finger, a key or a wheel touches the rail, and waits RESUME_AFTER
 *     before drifting again — so it never fights the person using it.
 *   - It never runs off-screen, in a background tab, or under `prefers-reduced-motion`.
 */
(() => {

const MOBILE = "(max-width: 760px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

const ADVANCE_EVERY = 3600;
const RESUME_AFTER = 6000;

const mobile = window.matchMedia(MOBILE);
const reduced = window.matchMedia(REDUCED);

function setupAuto(rail) {
  let tick = null;
  let resume = null;
  let onScreen = false;

  const stepWidth = () => {
    const first = rail.firstElementChild;
    if (!first) return 0;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  };

  const advance = () => {
    // scrollWidth - clientWidth is the last scrollable pixel; 2px absorbs subpixel rounding.
    const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
    rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + stepWidth(), behavior: "smooth" });
  };

  const stop = () => {
    clearInterval(tick);
    tick = null;
  };

  const start = () => {
    if (tick || !onScreen || !mobile.matches || reduced.matches || document.hidden) return;
    tick = setInterval(advance, ADVANCE_EVERY);
  };

  /** A touch, a wheel or an arrow key means the visitor is driving. Get out of the way. */
  const yield_ = () => {
    stop();
    clearTimeout(resume);
    resume = setTimeout(start, RESUME_AFTER);
  };

  ["pointerdown", "wheel", "keydown"].forEach((type) =>
    rail.addEventListener(type, yield_, { passive: true }),
  );
  rail.addEventListener("focusin", yield_);

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  mobile.addEventListener("change", () => (mobile.matches ? start() : stop()));
  reduced.addEventListener("change", () => (reduced.matches ? stop() : start()));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0.4 },
    ).observe(rail);
  } else {
    onScreen = true;
    start();
  }
}

document.querySelectorAll("[data-rail-auto]").forEach(setupAuto);

})();
