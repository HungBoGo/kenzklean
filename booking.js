const { SERVICES, EXTRAS, TURNAROUNDS, DROPOFF_SPOTS, findService, findTurnaround, isExtraIncluded, formatAud, quote } =
  window.KK;

const MAIN_STORE = DROPOFF_SPOTS.find((spot) => spot.mainStore);

/**
 * Two steps, not six. Step 1 holds every choice about the clean — service, extras, turnaround,
 * drop-off — because each has a safe default and none can block. Step 2 is the details form, and
 * its forward button confirms rather than continuing.
 */
const LAST_STEP = 2;

const params = new URLSearchParams(window.location.search);

const state = {
  step: 1,
  serviceId: SERVICES.some((s) => s.id === params.get("service")) ? params.get("service") : "basic",
  turnaroundId: TURNAROUNDS.some((t) => t.id === params.get("turnaround")) ? params.get("turnaround") : "standard",
  spotId: DROPOFF_SPOTS.some((s) => s.id === params.get("spot")) ? params.get("spot") : MAIN_STORE.id,
  pairs: clampPairs(params.get("pairs")),
  extraIds: [],
  details: {},
  orderCode: null,
};

function clampPairs(value) {
  return Math.max(1, Math.min(20, Number(value) || 1));
}

const isRush = () => findTurnaround(state.turnaroundId).mainStoreOnly;

/** The 24-hour tier is main-store-only, so any other spot the user picked earlier is invalid. */
function reconcileSpotWithTurnaround() {
  if (isRush()) state.spotId = MAIN_STORE.id;
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Re-rendering a group's innerHTML would destroy the input the user just activated
 * and drop keyboard focus, so selection state is toggled on the existing nodes.
 */
function syncSelection(name) {
  $$(`input[name="${name}"]`).forEach((input) => {
    input.closest(".choice-card").classList.toggle("selected", input.checked);
  });
}

/* ---------- Step 1: service + pairs ---------- */

function renderServiceChoices() {
  $("[data-service-choices]").innerHTML = SERVICES.map(
    (service) => `
      <label class="choice-card${state.serviceId === service.id ? " selected" : ""}">
        <input type="radio" name="service" value="${service.id}" ${
          state.serviceId === service.id ? "checked" : ""
        } />
        <span class="choice-head">
          <strong>${service.name}</strong>
          <span class="choice-price">$${service.price}</span>
        </span>
        <span class="choice-body">${service.summary}</span>
        <ul class="choice-includes">${service.includes.map((i) => `<li>${i}</li>`).join("")}</ul>
      </label>
    `,
  ).join("");
}

/* ---------- Step 2: extras ---------- */

function renderExtraChoices() {
  const service = findService(state.serviceId);

  $("[data-extra-choices]").innerHTML = EXTRAS.map((extra) => {
    const included = isExtraIncluded(extra, service.id);
    const checked = !included && state.extraIds.includes(extra.id);

    return `
      <label class="choice-card${checked ? " selected" : ""}${included ? " included" : ""}">
        <input
          type="checkbox"
          name="extra"
          value="${extra.id}"
          ${checked ? "checked" : ""}
          ${included ? "disabled" : ""}
        />
        <span class="choice-head">
          <strong>${extra.name}</strong>
          <span class="choice-price">${included ? "Included" : `$${extra.price}`}</span>
        </span>
        <span class="choice-body">
          ${included ? `Already part of ${service.name} — you are not charged twice.` : "Per pair."}
        </span>
      </label>
    `;
  }).join("");
}

/* ---------- Step 3: turnaround ---------- */

function renderTurnaroundChoices() {
  $("[data-turnaround-choices]").innerHTML = TURNAROUNDS.map(
    (tier) => `
      <label class="choice-card${state.turnaroundId === tier.id ? " selected" : ""}">
        <input type="radio" name="turnaround" value="${tier.id}" ${
          state.turnaroundId === tier.id ? "checked" : ""
        } />
        <span class="choice-head">
          <strong>${tier.window}</strong>
          <span class="choice-price">${tier.price === 0 ? "Included" : `+$${tier.price}`}</span>
        </span>
        <span class="choice-body">${tier.note}</span>
      </label>
    `,
  ).join("");
}

/* ---------- Step 4: drop-off spot ---------- */

function renderSpotChoices() {
  const rush = isRush();

  $("[data-rush-notice]").hidden = !rush;
  $("[data-spot-intro]").textContent = rush
    ? "24-hour orders are handled at the main store only."
    : "Pick the spot that suits you. We return your sneakers to your home for free.";

  $("[data-spot-choices]").innerHTML = DROPOFF_SPOTS.map((spot) => {
    const disabled = rush && !spot.mainStore;
    const checked = state.spotId === spot.id;

    return `
      <label class="choice-card${checked ? " selected" : ""}${disabled ? " disabled" : ""}">
        <input type="radio" name="spot" value="${spot.id}" ${checked ? "checked" : ""} ${
          disabled ? "disabled" : ""
        } />
        <span class="choice-head">
          <strong>${spot.name}</strong>
          ${spot.mainStore ? '<span class="tag">Main store</span>' : ""}
        </span>
        <span class="choice-body">${spot.address}</span>
        <span class="choice-meta">${disabled ? "Not available for 24-hour orders" : spot.hours}</span>
      </label>
    `;
  }).join("");
}

/* ---------- Step 5: details ---------- */

const VALIDATORS = {
  fullName: (value) => (value.trim().length >= 2 ? "" : "Enter your full name."),
  mobile: (value) =>
    /^(?:\+?61|0)4\d{8}$/.test(value.replace(/[\s-]/g, "")) ? "" : "Enter a valid Australian mobile, e.g. 0482 676 789.",
  email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "" : "Enter a valid email address."),
  street: (value) => (value.trim().length >= 4 ? "" : "Enter your street address."),
  suburb: (value) => (value.trim().length >= 2 ? "" : "Enter your suburb."),
  postcode: (value) => (/^\d{4}$/.test(value.trim()) ? "" : "Enter a 4-digit postcode."),
};

/** Rush orders are collected at the main store, so no return address is needed. */
function requiredDetailFields() {
  return isRush() ? ["fullName", "mobile", "email"] : Object.keys(VALIDATORS);
}

/**
 * Confirming a booking is the moment a visitor becomes an account holder — it is the only
 * point where they have already typed everything an account needs. Signed-in customers see
 * their details prefilled and locked to the account.
 */
function renderDetailsStep() {
  $("[data-return-address]").hidden = isRush();

  const user = window.KKAuth.currentUser();
  const note = $("[data-signed-in]");
  const form = $("[data-details-form]");

  $("[data-details-intro]").textContent = user
    ? "We use these to confirm your order and arrange the return."
    : "Confirming your booking creates your KENZ KLEAN account, so you can track this order.";

  note.hidden = !user;
  if (!user) return;

  note.textContent = `Signed in as ${user.fullName} (${user.email}).`;
  form.elements.fullName.value ||= user.fullName;
  form.elements.email.value ||= user.email;
  form.elements.mobile.value ||= user.mobile;
}

function validateDetails({ showErrors }) {
  const form = $("[data-details-form]");
  let firstInvalid = null;

  const valid = requiredDetailFields().every((field) => {
    const input = form.elements[field];
    const message = VALIDATORS[field](input.value);
    const errorEl = form.querySelector(`[data-error-for="${field}"]`);

    if (showErrors) {
      errorEl.textContent = message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (message && !firstInvalid) firstInvalid = input;
    }
    return !message;
  });

  if (showErrors && firstInvalid) firstInvalid.focus();
  return valid;
}

function captureDetails() {
  const form = $("[data-details-form]");
  state.details = {
    fullName: form.elements.fullName.value.trim(),
    mobile: form.elements.mobile.value.trim(),
    email: form.elements.email.value.trim(),
    street: form.elements.street.value.trim(),
    suburb: form.elements.suburb.value.trim(),
    postcode: form.elements.postcode.value.trim(),
    notes: form.elements.notes.value.trim(),
  };
}

/* ---------- Summary + review ---------- */

function currentQuote() {
  return quote({
    serviceId: state.serviceId,
    extraIds: state.extraIds,
    turnaroundId: state.turnaroundId,
    pairs: state.pairs,
  });
}

function renderSummary() {
  const result = currentQuote();

  $("[data-summary-lines]").innerHTML = result.lines
    .map(
      (line) => `
        <div class="summary-line">
          <dt>${line.label}${line.pairs > 1 ? ` <span class="times">× ${line.pairs}</span>` : ""}</dt>
          <dd>${formatAud(line.unit * line.pairs)}</dd>
        </div>
      `,
    )
    .join("");

  const total = formatAud(result.total);
  $("[data-summary-total]").textContent = total;
  $("[data-summary-total-mobile]").textContent = total;
  $("[data-summary-gst]").textContent = `Includes ${formatAud(result.gst)} GST`;

  // With the standalone review panel gone, this always-visible note carries the drop-off choice.
  const spot = DROPOFF_SPOTS.find((s) => s.id === state.spotId);
  $("[data-summary-note]").textContent = result.turnaround.mainStoreOnly
    ? `Drop-off and pick-up at ${spot.name}.`
    : `Drop off at ${spot.name} — free home delivery on return.`;
}

function reviewRows() {
  const result = currentQuote();
  const spot = DROPOFF_SPOTS.find((s) => s.id === state.spotId);
  const d = state.details;

  const rows = [
    ["Service", `${result.service.name} × ${state.pairs} pair${state.pairs > 1 ? "s" : ""}`],
    ["Extras", result.extras.length ? result.extras.map((e) => e.name).join(", ") : "None"],
    ["Turnaround", `${result.turnaround.window}${result.turnaround.price ? ` (+$${result.turnaround.price}/pair)` : ""}`],
    ["Drop-off", `${spot.name} — ${spot.address}`],
    ["Return", isRush() ? "Pick up at main store" : `Free home drop off — ${d.street}, ${d.suburb} ${d.postcode}`],
    ["Name", d.fullName],
    ["Mobile", d.mobile],
    ["Email", d.email],
  ];

  if (d.notes) rows.push(["Notes", d.notes]);
  rows.push(["Total (incl. GST)", formatAud(result.total)]);

  return rows
    .map(
      ([label, value]) => `
        <div class="review-row">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `,
    )
    .join("");
}

/* ---------- Step machine ---------- */

function showStep(step) {
  state.step = step;

  $$("[data-step]").forEach((panel) => {
    panel.hidden = panel.dataset.step !== String(step);
  });

  $$("[data-step-chip]").forEach((chip) => {
    const index = Number(chip.dataset.stepChip);
    chip.classList.toggle("current", index === step);
    chip.classList.toggle("complete", index < step);
    if (index === step) {
      chip.setAttribute("aria-current", "step");
    } else {
      chip.removeAttribute("aria-current");
    }
  });

  // One forward button per step. Continue carries you to the details; Confirm places the order.
  const onLastStep = step === LAST_STEP;
  $("[data-back]").disabled = step === 1;
  $("[data-next]").hidden = onLastStep;
  $("[data-next-mobile]").hidden = onLastStep;
  $("[data-confirm]").hidden = !onLastStep;
  $("[data-confirm-mobile]").hidden = !onLastStep;

  // Step 1's choices are all live from load. Only the details step is built on entry: the return
  // address depends on the turnaround chosen a moment ago, and the form may need prefilling.
  if (step === LAST_STEP) {
    renderDetailsStep();
    $("[data-confirm-error]").textContent = "";
    $("[data-confirm-note]").textContent = window.KKAuth.currentUser()
      ? "This order will be added to your account."
      : "Confirming creates your account so you can track this order.";
  }

  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function showSuccess() {
  // The details form is the last thing on the page, so Confirm is where it gets validated — there
  // is no longer a Continue click between the form and here to catch an empty field.
  if (!validateDetails({ showErrors: true })) return;
  captureDetails();

  const auth = window.KKAuth;
  const alreadySignedIn = Boolean(auth.currentUser());

  if (!alreadySignedIn) {
    const result = auth.register({
      fullName: state.details.fullName,
      email: state.details.email,
      mobile: state.details.mobile,
    });

    // An existing email means this is a returning customer, not a new sign-up.
    if (!result.ok) {
      $("[data-confirm-error]").textContent = result.error;
      $("[data-confirm-error]").scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
      return;
    }
  }

  state.orderCode = `KK-${Math.floor(10000 + Math.random() * 90000)}`;
  const result = currentQuote();
  const spot = DROPOFF_SPOTS.find((s) => s.id === state.spotId);

  auth.saveOrder({
    code: state.orderCode,
    service: result.service.name,
    extras: result.extras.map((e) => e.name),
    pairs: state.pairs,
    turnaround: result.turnaround.window,
    spot: spot.name,
    spotAddress: spot.address,
    total: result.total,
    placedAt: new Date().toISOString(),
  });

  $$("[data-step]").forEach((panel) => {
    panel.hidden = panel.dataset.step !== "done";
  });
  $("[data-stepper]").hidden = true;
  $("[data-step-nav]").hidden = true;
  $("[data-mobile-bar]").hidden = true;

  $("[data-order-code]").textContent = state.orderCode;
  $("[data-final-review]").innerHTML = reviewRows();
  $("[data-track-link]").href = `tracking.html?order=${state.orderCode}`;
  $("[data-success-note]").textContent = alreadySignedIn
    ? "Show this order number when you drop your sneakers off. It is now in your account."
    : `Show this order number when you drop your sneakers off. We created an account for ${state.details.email} so you can track it.`;

  $('[data-step="done"]').focus();
}

/**
 * Step 1's four choices each carry a valid default, so moving to the details step is never blocked.
 * The details themselves are checked at Confirm, in showSuccess.
 */
function goNext() {
  if (state.step < LAST_STEP) showStep(state.step + 1);
}

function goBack() {
  if (state.step > 1) showStep(state.step - 1);
}

/* ---------- Events ---------- */

function bindEvents() {
  document.addEventListener("change", (event) => {
    const input = event.target;

    if (input.name === "service") {
      state.serviceId = input.value;
      // Extras bundled into the new package must not stay selected as chargeable lines.
      state.extraIds = state.extraIds.filter(
        (id) => !isExtraIncluded(EXTRAS.find((e) => e.id === id), state.serviceId),
      );
      syncSelection("service");
      // Which extras are now "included" changed, and both grids share step 1. Redraw the extras.
      // Focus is on the service radio, a different group, so nothing the user is touching is lost.
      renderExtraChoices();
    }

    if (input.name === "extra") {
      state.extraIds = input.checked
        ? [...state.extraIds, input.value]
        : state.extraIds.filter((id) => id !== input.value);
      syncSelection("extra");
    }

    if (input.name === "turnaround") {
      state.turnaroundId = input.value;
      reconcileSpotWithTurnaround();
      syncSelection("turnaround");
      // A 24-hour order locks every spot but the main store — redraw them with the new constraint.
      renderSpotChoices();
    }

    if (input.name === "spot") {
      state.spotId = input.value;
      syncSelection("spot");
    }

    if (input.id === "pairs") {
      state.pairs = clampPairs(input.value);
      input.value = state.pairs;
    }

    renderSummary();
  });

  // Re-validate a field once it has been corrected, but never before the user has left it.
  $("[data-details-form]").addEventListener("blur", (event) => {
    const field = event.target.name;
    if (!VALIDATORS[field] || !requiredDetailFields().includes(field)) return;
    const message = VALIDATORS[field](event.target.value);
    $(`[data-error-for="${field}"]`).textContent = message;
    event.target.setAttribute("aria-invalid", message ? "true" : "false");
  }, true);

  $("[data-next]").addEventListener("click", goNext);
  $("[data-next-mobile]").addEventListener("click", goNext);
  $("[data-back]").addEventListener("click", goBack);
  $("[data-confirm]").addEventListener("click", showSuccess);
  $("[data-confirm-mobile]").addEventListener("click", showSuccess);
}

reconcileSpotWithTurnaround();
renderServiceChoices();
renderExtraChoices();
renderTurnaroundChoices();
renderSpotChoices();
$("#pairs").value = state.pairs;
renderSummary();
showStep(1);
bindEvents();
