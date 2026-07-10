const { formatAud } = window.KK;
const auth = window.KKAuth;

/**
 * The gate here is UX, not security — see the warning at the top of auth.js.
 * A real build authorises the order lookup server-side against the session.
 *
 * The timeline mirrors the order lifecycle in ARCHITECTURE_SECURITY.md.
 */
const TIMELINE = [
  { label: "Order placed", detail: "We have your booking and your order number." },
  { label: "Dropped off", detail: "Your sneakers are with us." },
  { label: "Inspection", detail: "We check material, staining and damage before any work starts." },
  { label: "Cleaning", detail: "Your chosen package is carried out on each pair." },
  { label: "Quality check", detail: "Before and after photos are taken and reviewed." },
  { label: "Out for return", detail: "On the way back to you, or ready for pick-up." },
  { label: "Complete", detail: "Back in your hands." },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollBehavior = () => (reducedMotion() ? "auto" : "smooth");

const VALIDATORS = {
  fullName: (v) => (v.trim().length >= 2 ? "" : "Enter your full name."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address."),
  mobile: (v) =>
    /^(?:\+?61|0)4\d{8}$/.test(v.replace(/[\s-]/g, "")) ? "" : "Enter a valid Australian mobile.",
};

/* ---------- Tabs ---------- */

function bindTabs() {
  $$("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      $$("[data-tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === target)));
      $$("[data-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== target;
      });
    });
  });
}

/* ---------- Log in ---------- */

function bindLogin() {
  const emailForm = $("[data-login-form]");
  const codeStep = $("[data-code-step]");
  const codeForm = $("[data-code-form]");
  const errorEl = $("[data-login-error]");

  emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const email = emailForm.elements.email.value;
    const message = VALIDATORS.email(email);
    if (message) {
      errorEl.textContent = message;
      return;
    }

    const result = auth.requestCode(email);
    if (!result.ok) {
      errorEl.textContent = result.error;
      codeStep.hidden = true;
      return;
    }

    $("[data-demo-code]").textContent = result.code;
    codeStep.hidden = false;
    codeForm.elements.code.focus();
  });

  codeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const result = auth.verifyCode(codeForm.elements.code.value);
    if (!result.ok) {
      errorEl.textContent = result.error;
      return;
    }
    render();
  });
}

/* ---------- Register ---------- */

function bindRegister() {
  const form = $("[data-register-form]");
  const errorEl = $("[data-register-error]");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    let firstInvalid = null;
    const valid = Object.keys(VALIDATORS).every((field) => {
      const input = form.elements[field];
      const message = VALIDATORS[field](input.value);
      form.querySelector(`[data-error-for="${field}"]`).textContent = message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (message && !firstInvalid) firstInvalid = input;
      return !message;
    });

    if (!valid) {
      firstInvalid.focus();
      return;
    }

    const result = auth.register({
      fullName: form.elements.fullName.value,
      email: form.elements.email.value,
      mobile: form.elements.mobile.value,
    });

    if (!result.ok) {
      errorEl.textContent = result.error;
      return;
    }
    render();
  });
}

/* ---------- Orders ---------- */

function renderTimeline(currentIndex) {
  $("[data-timeline]").innerHTML = TIMELINE.map((stage, index) => {
    const stateClass = index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
    // Colour alone never carries the state — each step is labelled too.
    const stateLabel = index < currentIndex ? "Done" : index === currentIndex ? "In progress" : "Not started";

    return `
      <li class="timeline-step ${stateClass}">
        <span class="timeline-marker" aria-hidden="true"></span>
        <div>
          <strong>${stage.label}</strong>
          <span class="timeline-state">${stateLabel}</span>
          <p>${stage.detail}</p>
        </div>
      </li>
    `;
  }).join("");
}

function showOrder(code) {
  const order = auth.findMyOrder(code);
  if (!order) return;

  $$("[data-order-card]").forEach((card) => {
    card.classList.toggle("active", card.dataset.orderCard === order.code);
    card.setAttribute("aria-pressed", String(card.dataset.orderCard === order.code));
  });

  $("[data-result-code]").textContent = order.code;

  const rows = [
    ["Service", `${order.service} × ${order.pairs} pair${order.pairs > 1 ? "s" : ""}`],
    ["Extras", order.extras?.length ? order.extras.join(", ") : "None"],
    ["Turnaround", order.turnaround],
    ["Drop-off", `${order.spot} — ${order.spotAddress}`],
    ["Total (incl. GST)", formatAud(order.total)],
    ["Placed", new Date(order.placedAt).toLocaleString("en-AU")],
  ];

  $("[data-result-details]").innerHTML = rows
    .map(([label, value]) => `<div class="review-row"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");

  // A freshly placed order sits at "Order placed" until it is physically dropped off.
  renderTimeline(0);

  const result = $("[data-result]");
  result.hidden = false;
  result.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
}

function renderOrders() {
  const orders = auth.myOrders();
  const list = $("[data-order-list]");

  $("[data-empty]").hidden = orders.length > 0;
  list.hidden = orders.length === 0;

  if (!orders.length) {
    $("[data-result]").hidden = true;
    return;
  }

  list.innerHTML = orders
    .map(
      (order) => `
        <li>
          <button class="order-card" type="button" data-order-card="${order.code}" aria-pressed="false">
            <span class="order-card-main">
              <strong>${order.code}</strong>
              <span>${order.service} × ${order.pairs} pair${order.pairs > 1 ? "s" : ""}</span>
              <small>${order.turnaround} · ${order.spot}</small>
            </span>
            <span class="order-card-side">
              <strong>${formatAud(order.total)}</strong>
              <span class="status-pill small">
                <span class="status-dot" aria-hidden="true"></span> Awaiting drop-off
              </span>
            </span>
          </button>
        </li>
      `,
    )
    .join("");

  $$("[data-order-card]").forEach((card) => {
    card.addEventListener("click", () => showOrder(card.dataset.orderCard));
  });

  // Deep link from the booking confirmation, otherwise open the most recent order.
  const wanted = new URLSearchParams(window.location.search).get("order");
  const initial = wanted && auth.findMyOrder(wanted) ? wanted.toUpperCase() : orders[0].code;
  showOrder(initial);
}

/* ---------- Top-level render ---------- */

function render() {
  const user = auth.currentUser();

  $("[data-gate]").hidden = Boolean(user);
  $("[data-account]").hidden = !user;

  if (!user) return;

  $("[data-greeting]").textContent = `Welcome back, ${user.fullName.split(" ")[0]}.`;
  renderOrders();
  $("[data-account]").focus();
}

$("[data-sign-out]").addEventListener("click", () => {
  auth.signOut();
  window.location.reload();
});

bindTabs();
bindLogin();
bindRegister();
render();
