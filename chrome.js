/**
 * The bits of the header that every page shares.
 *
 * The markup itself is duplicated into each page rather than injected here, so the navigation and
 * the footer exist before a single byte of JavaScript runs — a crawler and a visitor with a dead
 * script both still get a working site. This file only does the two things that cannot be static:
 * who is signed in, and whether the page has been scrolled.
 */
(() => {

/** Tracking lives behind the account door, so the header has to say which side you are on. */
function renderAccountSlot() {
  const slot = document.querySelector("[data-account-slot]");
  if (!slot || !window.KKAuth) return;

  const signedIn = Boolean(window.KKAuth.currentUser());

  // A plain text label, so buttons.js can give it the same hover as every other button.
  slot.innerHTML = signedIn
    ? '<a class="ghost-button" href="tracking.html">My orders</a>'
    : '<a class="ghost-button" href="tracking.html">Log in</a>';
}

function bindHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const sync = () => header.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

renderAccountSlot();
bindHeaderScroll();

})();
