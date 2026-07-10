/**
 * Button hover choreography.
 *
 * Both effects need a second copy of the label. That copy is a `::after` pseudo-element fed by
 * `data-label`, never a duplicated text node — a second text node would double `textContent`,
 * which reads back doubled to scripts and to anything walking the DOM. Pseudo content stays out
 * of the accessibility tree and out of `textContent` for free.
 *
 * This file only wraps the label; every transition lives in the stylesheet, so a stale or
 * failed script leaves ordinary, working buttons behind.
 *
 * Buttons rendered later (service cards, drop-off spots, booking choices) are caught by a
 * MutationObserver rather than a second manual pass.
 */
(() => {

const SELECTOR = ".primary-button, .secondary-button, .ghost-button";

/** Only plain-text buttons. Anything holding an icon or a nested span is left alone. */
function isPlainLabel(el) {
  if (el.querySelector("svg, .btn-face")) return false;
  return el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE;
}

function enhance(el) {
  if (!isPlainLabel(el)) return;

  const label = el.textContent.trim();
  if (!label) return;

  const face = document.createElement("span");
  face.className = "btn-face";
  face.dataset.label = label;
  face.textContent = label;

  el.textContent = "";
  el.appendChild(face);
}

const enhanceAll = (root) => {
  if (root.matches?.(SELECTOR)) enhance(root);
  root.querySelectorAll?.(SELECTOR).forEach(enhance);
};

enhanceAll(document);

new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceAll(node);
    });
  });
}).observe(document.body, { childList: true, subtree: true });

})();
