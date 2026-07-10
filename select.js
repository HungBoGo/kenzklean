/**
 * A dark, animated listbox that stands in for `<select>`.
 *
 * A native select's popup is drawn by the operating system: it cannot be styled, cannot be
 * animated, and on this page it opened as a white sheet in the middle of a black form.
 *
 * The native element stays in the DOM and stays the source of truth. Every choice is written back
 * to it and an `input` + `change` pair is dispatched, so the pricing code that already listens on
 * the form keeps working and never learns this file exists. Without the script the plain select
 * is still there, still usable.
 *
 * Keyboard: Enter/Space/Down opens, Up/Down move, Home/End jump, typing jumps to a label,
 * Enter picks, Escape cancels and restores focus. Follows the ARIA combobox pattern.
 */
(() => {

const selects = document.querySelectorAll("[data-listbox]");
if (!selects.length) return;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let openInstance = null;

function enhance(select) {
  const wrap = document.createElement("div");
  wrap.className = "listbox";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "listbox-button";
  button.setAttribute("role", "combobox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "listbox");
  if (select.id) button.setAttribute("aria-labelledby", `${select.id}-label ${select.id}-value`);

  const value = document.createElement("span");
  value.className = "listbox-value";
  if (select.id) value.id = `${select.id}-value`;

  button.append(value);
  button.insertAdjacentHTML(
    "beforeend",
    '<svg class="listbox-caret" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>',
  );

  const list = document.createElement("ul");
  list.className = "listbox-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  if (select.id) list.id = `${select.id}-list`;
  button.setAttribute("aria-controls", list.id);

  const options = [...select.options].map((option, index) => {
    const item = document.createElement("li");
    item.className = "listbox-option";
    item.setAttribute("role", "option");
    item.id = `${select.id}-opt-${index}`;
    item.textContent = option.textContent.trim();
    item.dataset.value = option.value;
    list.append(item);
    return item;
  });

  select.parentNode.insertBefore(wrap, select);
  wrap.append(button, list);
  wrap.append(select);

  // Out of the tab order and out of the accessibility tree: the combobox speaks for it now.
  select.classList.add("listbox-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  let activeIndex = Math.max(0, select.selectedIndex);

  const paint = () => {
    value.textContent = select.options[select.selectedIndex]?.textContent.trim() ?? "";
    options.forEach((item, i) => {
      const selected = i === select.selectedIndex;
      item.setAttribute("aria-selected", String(selected));
      item.classList.toggle("is-selected", selected);
      item.classList.toggle("is-active", i === activeIndex);
    });
    button.setAttribute("aria-activedescendant", list.hidden ? "" : options[activeIndex]?.id ?? "");
  };

  /* ---------- Open / close ---------- */

  function openList() {
    if (!list.hidden) return;
    openInstance?.closeList();
    openInstance = api;

    activeIndex = Math.max(0, select.selectedIndex);
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    paint();

    if (!reduced()) {
      list.animate(
        { opacity: [0, 1], transform: ["translateY(-6px) scaleY(0.96)", "none"] },
        { duration: 200, easing: "cubic-bezier(0.22, 0.7, 0.24, 1)" },
      );
    }
    options[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function closeList({ focus = false } = {}) {
    if (list.hidden) return;
    if (openInstance === api) openInstance = null;

    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-activedescendant", "");

    const hide = () => {
      list.hidden = true;
    };

    if (reduced()) hide();
    else {
      const animation = list.animate(
        { opacity: [1, 0], transform: ["none", "translateY(-6px) scaleY(0.96)"] },
        { duration: 150, easing: "ease-in" },
      );
      animation.onfinish = hide;
    }

    if (focus) button.focus();
  }

  /** The native select stays authoritative, so the existing pricing listeners keep firing. */
  function commit(index) {
    if (index < 0 || index >= options.length) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    paint();
  }

  const api = { closeList };

  /* ---------- Pointer ---------- */

  button.addEventListener("click", () => (list.hidden ? openList() : closeList()));

  options.forEach((item, index) => {
    item.addEventListener("click", () => {
      commit(index);
      closeList({ focus: true });
    });
    item.addEventListener("pointermove", () => {
      activeIndex = index;
      paint();
    });
  });

  /* ---------- Keyboard ---------- */

  const move = (next) => {
    activeIndex = Math.min(options.length - 1, Math.max(0, next));
    paint();
    options[activeIndex].scrollIntoView({ block: "nearest" });
  };

  let typed = "";
  let typedTimer = null;

  button.addEventListener("keydown", (event) => {
    const closed = list.hidden;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (closed) openList();
        else move(activeIndex + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (closed) openList();
        else move(activeIndex - 1);
        return;
      case "Home":
        if (closed) return;
        event.preventDefault();
        move(0);
        return;
      case "End":
        if (closed) return;
        event.preventDefault();
        move(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (closed) openList();
        else {
          commit(activeIndex);
          closeList({ focus: true });
        }
        return;
      case "Escape":
        if (closed) return;
        event.preventDefault();
        closeList({ focus: true });
        return;
      case "Tab":
        closeList();
        return;
      default:
        break;
    }

    if (event.key.length !== 1) return;

    clearTimeout(typedTimer);
    typed += event.key.toLowerCase();
    typedTimer = setTimeout(() => (typed = ""), 600);

    const hit = options.findIndex((item) => item.textContent.toLowerCase().startsWith(typed));
    if (hit === -1) return;

    if (closed) commit(hit);
    else move(hit);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target)) closeList();
  });

  // Anything that changes the select behind our back — a reset, a URL prefill — must show.
  select.addEventListener("change", paint);
  paint();
}

selects.forEach(enhance);

})();
