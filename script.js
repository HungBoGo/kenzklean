const { BRAND, SERVICES, EXTRAS, TURNAROUNDS, DROPOFF_SPOTS, formatAud, mapsUrl, quote } = window.KK;

function renderServices() {
  const list = document.querySelector("[data-service-list]");
  if (!list) return;

  list.innerHTML = SERVICES.map(
    (service) => `
      <article class="service-card${service.badge ? " featured" : ""}" data-reveal>
        ${service.badge ? `<span class="badge">${service.badge}</span>` : ""}
        <div>
          <h3>${service.name}</h3>
          <span class="price">$${service.price}</span>
          <span class="price-unit">per pair, incl. GST</span>
        </div>
        <p>${service.summary}</p>
        <ul>${service.includes.map((item) => `<li>${item}</li>`).join("")}</ul>
        <div class="service-foot">
          <a class="secondary-button" href="booking.html?service=${service.id}">
            Select ${service.name}
          </a>
        </div>
      </article>
    `,
  ).join("");
}

function renderExtras() {
  const list = document.querySelector("[data-extras-list]");
  if (!list) return;

  list.innerHTML = EXTRAS.map(
    (extra) => `
      <li class="extra-row">
        <span class="extra-name">${extra.name}</span>
        <span class="extra-price">$${extra.price}</span>
        ${
          extra.includedIn.length
            ? `<span class="extra-note">Included in ${extra.includedIn
                .map((id) => SERVICES.find((s) => s.id === id).name)
                .join(", ")}</span>`
            : ""
        }
      </li>
    `,
  ).join("");
}

function renderTurnarounds() {
  const list = document.querySelector("[data-turnaround-list]");
  if (!list) return;

  list.innerHTML = TURNAROUNDS.map(
    (tier) => `
      <li class="turnaround-row">
        <span class="turnaround-window">${tier.window}</span>
        <span class="turnaround-price">${tier.price === 0 ? "Included" : `+$${tier.price} per pair`}</span>
        <span class="turnaround-note">${tier.note}</span>
      </li>
    `,
  ).join("");
}

function renderSpots() {
  const list = document.querySelector("[data-spot-list]");
  const intro = document.querySelector("[data-spots-intro]");
  const count = document.querySelector("[data-location-count]");
  if (!list) return;

  if (count) {
    count.textContent = BRAND.advertisedLocations;
    // anim.js picks this up and counts to it; the final value is already on screen either way.
    count.dataset.count = BRAND.advertisedLocations;
  }

  if (intro) {
    // The one claim the seam badges do not carry, and the reason the network works at all.
    intro.textContent =
      `Our spots sit inside barbers, cafés and clubs across Melbourne — ${BRAND.advertisedLocations} of them. ` +
      `${DROPOFF_SPOTS.length} are published below; call us on ${BRAND.phone} for the one nearest you.`;
  }

  list.innerHTML = DROPOFF_SPOTS.map(
    (spot) => `
      <li class="spot-card" data-spot-id="${spot.id}" data-reveal data-haystack="${`${spot.suburb} ${spot.address} ${spot.venue}`.toLowerCase()}">
        <div class="spot-body">
          <strong>${spot.name}</strong>
          ${spot.mainStore ? '<span class="tag">Main store</span>' : ""}
          <span class="spot-venue">Inside ${spot.venue}</span>
          <span>${spot.address}</span>
          <small>${spot.hours}</small>
        </div>
        <div class="spot-actions">
          <a class="secondary-button" href="${mapsUrl(spot)}" target="_blank" rel="noreferrer">
            Get directions
          </a>
          <a class="ghost-button" href="booking.html?spot=${spot.id}">Book here</a>
        </div>
      </li>
    `,
  ).join("");
}

function bindSpotSearch() {
  const search = document.querySelector("#spot-search");
  const clear = document.querySelector("#clear-search");
  const status = document.querySelector("[data-spot-status]");
  if (!search || !status) return;

  const filter = () => {
    const query = search.value.toLowerCase().trim();
    let visible = 0;

    document.querySelectorAll(".spot-card").forEach((card) => {
      const match = card.dataset.haystack.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    });

    if (!query) {
      status.textContent = `${DROPOFF_SPOTS.length} published drop-off spots.`;
    } else if (visible === 0) {
      status.textContent = `No published spot matches "${search.value}". Call ${BRAND.phone} for the nearest one.`;
    } else {
      status.textContent = `${visible} spot${visible === 1 ? "" : "s"} match "${search.value}".`;
    }
  };

  search.addEventListener("input", filter);
  clear?.addEventListener("click", () => {
    search.value = "";
    filter();
    search.focus();
  });

  filter();
}

/**
 * Rolls a value into place: the characters churn and lock left to right, like an odometer
 * settling. Digits churn through digits and letters through letters, so "Free" never flickers
 * into "3fx4". The element already holds a correct value, so a cancelled roll leaves the truth
 * behind, and reduced-motion skips straight to it.
 */
const rolling = new WeakMap();

function roll(el, text) {
  if (!el || el.textContent === text) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = text;
    return;
  }

  cancelAnimationFrame(rolling.get(el));

  const DURATION = 620;
  const LOCK_BY = 0.72; // every character is settled by this fraction of the run
  const DIGITS = "0123456789";
  const LETTERS = "abcdefghijklmnopqrstuvwxyz";
  const target = [...text];
  const started = performance.now();

  const churn = (ch) => {
    if (/\d/.test(ch)) return DIGITS[Math.floor(Math.random() * 10)];
    if (/[a-z]/i.test(ch)) {
      const c = LETTERS[Math.floor(Math.random() * 26)];
      return ch === ch.toUpperCase() ? c.toUpperCase() : c;
    }
    return ch; // punctuation holds still, so the shape of the value never jumps
  };

  const tick = (now) => {
    const t = Math.min(1, (now - started) / DURATION);

    el.textContent = target
      .map((ch, i) => {
        const lockAt = ((i + 1) / target.length) * LOCK_BY;
        return t >= lockAt ? ch : churn(ch);
      })
      .join("");

    if (t < 1) rolling.set(el, requestAnimationFrame(tick));
    else {
      rolling.delete(el);
      el.textContent = text;
    }
  };

  rolling.set(el, requestAnimationFrame(tick));
}

/** What the three figures beside the quote form should read, for the current choice. */
function quoteStats(service, turnaround) {
  const rush = turnaround.mainStoreOnly;
  return {
    price: { value: `$${service.price}`, note: `Per pair, ${service.name}` },
    turnaround: rush
      ? { value: "24", note: "Hours, main store only" }
      : { value: turnaround.window.split(" ")[0], note: "Business days" },
    return: rush
      ? { value: "Store", note: "Pick-up at the main store" }
      : { value: "Free", note: "Return delivery to your door" },
  };
}

function bindQuickBook() {
  const form = document.querySelector("[data-quick-book]");
  if (!form) return;

  const serviceSelect = form.querySelector("#quick-service");
  const pairsInput = form.querySelector("#quick-pairs");
  const turnaroundSelect = form.querySelector("#quick-turnaround");
  const totalEl = form.querySelector("[data-quick-total]");
  const noteEl = form.querySelector("[data-quick-note]");

  serviceSelect.innerHTML = SERVICES.map(
    (service) => `<option value="${service.id}">${service.name} — $${service.price}</option>`,
  ).join("");

  turnaroundSelect.innerHTML = TURNAROUNDS.map(
    (tier) =>
      `<option value="${tier.id}">${tier.window}${tier.price ? ` (+$${tier.price}/pair)` : ""}</option>`,
  ).join("");

  const update = () => {
    // A blank or sub-1 input would otherwise quote $0 while the field looks merely empty.
    const pairs = Math.max(1, Math.min(20, Number(pairsInput.value) || 1));
    const result = quote({
      serviceId: serviceSelect.value,
      turnaroundId: turnaroundSelect.value,
      pairs,
    });

    roll(totalEl, formatAud(result.total));
    noteEl.textContent = result.turnaround.mainStoreOnly
      ? "24-hour orders are dropped off and picked up at the main store."
      : "Includes free home drop off on return.";

    const stats = quoteStats(result.service, result.turnaround);
    Object.entries(stats).forEach(([key, { value, note }]) => {
      roll(document.querySelector(`[data-stat="${key}"]`), value);
      const noteNode = document.querySelector(`[data-stat-note="${key}"]`);
      if (noteNode) noteNode.textContent = note;
    });
  };

  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams({
      service: serviceSelect.value,
      turnaround: turnaroundSelect.value,
      pairs: String(Math.max(1, Math.min(20, Number(pairsInput.value) || 1))),
    });
    window.location.href = `booking.html?${params}`;
  });

  update();
}

/** The nearest ancestor that scrolls, or null if nothing between here and the body clips. */
function scrollParent(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowX + style.overflowY)) return node;
  }
  return null;
}

/**
 * The hidden pre-reveal state lives behind `.js-reveal`, added here and only here.
 * If IntersectionObserver is missing, or the visitor asked for reduced motion, the class
 * is never added and every section simply renders in place.
 *
 * An IntersectionObserver clips against every scrolling ancestor, not only the viewport. On a phone
 * the guarantee badges and the process steps become horizontal rails, and the drop-off list scrolls
 * inside itself — so a card parked off the edge never intersects the viewport, never reveals, and
 * stays invisible for good, even once you swipe to it.
 *
 * Cards inside a scroll container are therefore revealed with the container, all at once, staggered.
 * Watching each card against the container instead would reveal them as they slide in, which looks
 * better — but a card the scroll jumps clean over is never seen entering, and an invisible card is
 * a worse outcome than a card that missed its entrance.
 */
function bindReveal() {
  const targets = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!targets.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("js-reveal");

  // Stagger siblings so a row of cards flows in rather than popping all at once. Capped, because
  // the drop-off list is meant to hold every spot we open — an unbounded ramp would make the
  // hundredth card wait eight seconds to appear.
  const indexInGroup = new Map();
  targets.forEach((el) => {
    const next = indexInGroup.get(el.parentElement) ?? 0;
    el.style.setProperty("--reveal-delay", Math.min(next, 5));
    indexInGroup.set(el.parentElement, next + 1);
  });

  // Cards that clip: keyed by the container, revealed with it. Cards that don't: watched directly.
  const grouped = new Map();
  const loose = [];

  targets.forEach((el) => {
    const scroller = scrollParent(el);
    if (!scroller) return loose.push(el);
    if (!grouped.has(scroller)) grouped.set(scroller, []);
    grouped.get(scroller).push(el);
  });

  const looseObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        looseObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  loose.forEach((el) => looseObserver.observe(el));

  grouped.forEach((cards, scroller) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        cards.forEach((card) => card.classList.add("revealed"));
        observer.disconnect();
      },
      { threshold: 0.08 },
    );
    observer.observe(scroller);
  });
}

renderServices();
renderExtras();
renderTurnarounds();
renderSpots();
bindSpotSearch();
bindQuickBook();
bindReveal();
