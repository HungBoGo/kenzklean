/**
 * The $10-off signup popup.
 *
 * ⚠️  NOT WIRED TO A MAILING LIST. There is no backend, so `submit` records the address in
 * localStorage and nothing leaves the browser. Replace `deliver()` with a POST to Square, or to
 * whatever list the business actually runs. The dialog says so on screen; delete that line at the
 * same time you delete the TODO.
 *
 * Built on <dialog>.showModal(), which gives a focus trap, Escape-to-close, focus restoration and
 * an inert background for free. A hand-rolled modal gets at least one of those wrong.
 *
 * It waits. An overlay thrown at someone in their first second is an ad; one that arrives after
 * they have read something is an offer. Whichever comes first: eight seconds, or a third of the
 * page scrolled. It never returns once dismissed or subscribed.
 */
(() => {

const dialog = document.querySelector("[data-promo]");
if (!dialog || typeof dialog.showModal !== "function") return;

const STORAGE_KEY = "kk-promo";
const DELAY_MS = 8000;
const SCROLL_FRACTION = 0.33;

const seen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // Storage blocked: never nag, since we could not remember not to.
  }
};

const remember = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* private mode; the dialog simply reappears next session */
  }
};

if (seen()) return;

/* ---------- Opening ---------- */

let opened = false;

function open() {
  if (opened || dialog.open) return;
  opened = true;
  clearTimeout(timer);
  window.removeEventListener("scroll", onScroll);
  dialog.showModal();
}

const timer = setTimeout(open, DELAY_MS);

function onScroll() {
  const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
  if (scrolled > SCROLL_FRACTION) open();
}

window.addEventListener("scroll", onScroll, { passive: true });

/* ---------- Closing ---------- */

// `cancel` fires on Escape; `close` covers every route out, including the backdrop click below.
dialog.addEventListener("close", () => remember(dialog.returnValue === "subscribed" ? "subscribed" : "dismissed"));

dialog.querySelector("[data-promo-close]").addEventListener("click", () => dialog.close("dismissed"));

// Clicking the backdrop means clicking the <dialog> itself: its children cover the panel.
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close("dismissed");
});

/* ---------- Submitting ---------- */

const form = dialog.querySelector("[data-promo-form]");
const errorEl = dialog.querySelector("[data-promo-error]");

/** TODO: POST to the real list. Until then the address goes nowhere. */
function deliver(details) {
  try {
    localStorage.setItem("kk-promo-signup", JSON.stringify({ ...details, at: new Date().toISOString() }));
  } catch {
    /* nothing to keep */
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const email = form.elements.email.value.trim();
  const consent = form.elements.consent.checked;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = "Enter a valid email address.";
    form.elements.email.focus();
    return;
  }

  // Australian Spam Act: consent has to be given, not assumed. The box ships unchecked.
  if (!consent) {
    errorEl.textContent = "Please tick the box so we may email you.";
    form.elements.consent.focus();
    return;
  }

  deliver({
    firstName: form.elements.firstName.value.trim(),
    lastName: form.elements.lastName.value.trim(),
    email,
  });

  dialog.querySelector("[data-promo-form-view]").hidden = true;
  dialog.querySelector("[data-promo-done]").hidden = false;
  dialog.returnValue = "subscribed";
});

dialog.querySelector("[data-promo-done-close]").addEventListener("click", () => dialog.close("subscribed"));

})();
