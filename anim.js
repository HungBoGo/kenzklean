/**
 * Scroll choreography. Loaded after script.js so the cards it animates already exist.
 *
 * Two rules hold everything together:
 *
 * 1. Nothing here is required for the page to work. Every element is fully visible and correct
 *    before this file runs. GSAP only tweens *from* an offset state, never *to* a hidden one.
 *    If the vendor scripts fail to load, the page is simply still.
 *
 * 2. Every effect lives inside gsap.matchMedia(), keyed on `prefers-reduced-motion` and width.
 *    When either stops matching, GSAP reverts the tweens and their inline styles automatically.
 */
(() => {

if (!window.gsap || !window.ScrollTrigger) return;

gsap.registerPlugin(ScrollTrigger);

/* ---------- Anchor smoothing ----------
   `scroll-behavior: smooth` was removed from the stylesheet because it fights ScrollTrigger's
   own scroll writes. Anchors get a transient smooth scroll here instead. */
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;

  const id = link.getAttribute("href");
  if (id === "#" || id === "#main") return;

  const target = document.querySelector(id);
  if (!target) return;

  event.preventDefault();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
});

/**
 * Wraps each word in a masking span. Text-only headings: anything with child elements is
 * left alone rather than having its markup flattened.
 */
function splitWords(heading) {
  if (heading.children.length || heading.dataset.split === "done") return false;

  const words = heading.textContent.trim().split(/\s+/);
  heading.textContent = "";

  words.forEach((word, index) => {
    const mask = document.createElement("span");
    mask.className = "word";
    const inner = document.createElement("span");
    inner.textContent = word;
    mask.appendChild(inner);
    heading.appendChild(mask);
    if (index < words.length - 1) heading.append(" ");
  });

  heading.dataset.split = "done";
  return true;
}

/**
 * Counts up to the number in data-count. The element already shows its final value, so a
 * failure here leaves the correct price on screen.
 */
function countUp(el) {
  const target = Number(el.dataset.count);
  const prefix = el.dataset.prefix || "";
  const proxy = { value: 0 };

  gsap.to(proxy, {
    value: target,
    duration: 1.4,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 88%", once: true },
    onUpdate: () => {
      el.textContent = prefix + Math.round(proxy.value);
    },
    onComplete: () => {
      el.textContent = prefix + target;
    },
  });
}

/* ---------- Choreography ---------- */

const mm = gsap.matchMedia();

// Everything motion-related. Reverts itself if the visitor turns reduced motion on.
mm.add("(prefers-reduced-motion: no-preference)", () => {
  const hero = document.querySelector(".hero-section");
  const heroTitle = document.querySelector("#hero-title");

  // [data-split] rather than a tag selector: the hero's light-side twin is a <p>, not an <h1>.
  document.querySelectorAll("[data-split], .section-heading h2").forEach(splitWords);

  /**
   * fromTo, never from.
   *
   * A `from()` tween captures whatever the element's current value happens to be and uses it as
   * the *end* value. `ScrollTrigger.refresh()` on window load reverts inline styles to measure
   * layout — if it lands while a `from()` tween is mid-flight, the tween re-captures its end
   * value as the offset state and animates 0 → 0. The hero buttons stayed invisible for exactly
   * that reason. Declaring both ends removes the guesswork.
   */
  const RISE = { opacity: 1, ease: "power3.out" };

  /**
   * The hero headline exists twice — the real <h1> on the dark side, and a mute <p> twin on the
   * light side. Both are split and animated together. Their boxes are identical, so the two
   * word-rises land on the same pixels and read as one.
   */
  if (heroTitle) {
    gsap
      .timeline()
      .fromTo(".hero-copy-layer .eyebrow", { y: 16, opacity: 0 }, { ...RISE, y: 0, duration: 0.5 })
      .fromTo(".hero-copy .word > span", { yPercent: 115 }, { ...RISE, yPercent: 0, duration: 0.85, stagger: 0.022 }, "-=0.2")
      .fromTo(".hero-lede", { y: 18, opacity: 0 }, { ...RISE, y: 0, duration: 0.6 }, "-=0.5")
      .fromTo(".hero-cta > *", { y: 16, opacity: 0 }, { ...RISE, y: 0, duration: 0.5, stagger: 0.08 }, "-=0.35");
  }

  // Remaining headings rise out of their own baseline as they scroll into view.
  document.querySelectorAll(".section-heading h2").forEach((heading) => {
    gsap.fromTo(
      heading.querySelectorAll(".word > span"),
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.035,
        scrollTrigger: { trigger: heading, start: "top 88%", once: true },
      },
    );
  });

  document.querySelectorAll("[data-count]").forEach(countUp);

  // The dashed thread between the five steps draws itself left to right.
  const steps = gsap.utils.toArray(".process-grid li");
  if (steps.length) {
    gsap.fromTo(
      steps,
      { "--line-scale": 0 },
      {
        "--line-scale": 1,
        duration: 0.5,
        ease: "power2.inOut",
        stagger: 0.12,
        scrollTrigger: { trigger: ".process-grid", start: "top 70%", once: true },
      },
    );
  }

  /**
   * The before/after divider used to be scrubbed by scroll, which forced the visitor through
   * 190vh of sticky section before the page would move on. It is a control now — see
   * compare.js — so scroll gets out of its way entirely.
   */
});

// Late-loading images change section heights and would leave every trigger measured wrong.
window.addEventListener("load", () => ScrollTrigger.refresh());

})();
