/**
 * The drop-off map.
 *
 * MapLibre GL (BSD-3) with two interchangeable basemaps:
 *
 *   MAPTILER_KEY === ""   a road network baked out of OpenStreetMap once, offline, and shipped as
 *                         `img/roads.geojson`. No provider, no key, no request quota. Covers only
 *                         the bbox around the four spots; there are no laneways.
 *
 *   MAPTILER_KEY !== ""   MapTiler's dark vector tiles. Streets everywhere, every zoom. Paste the
 *                         key below and nothing else changes — the markers, the list sync and the
 *                         Google Maps hand-off are provider-agnostic on purpose.
 *
 * The library is 206 KB gzipped, so it is fetched only once the section is close to the viewport,
 * and never at all if the visitor asked to save data. Without it the list keeps working: that is
 * the whole reason the addresses are still text on the page.
 *
 * Basemap © OpenStreetMap contributors (ODbL). Glyphs are Noto Sans (OFL), self-hosted.
 */
(() => {

/**
 * ⚠️  This key ships inside a static page: anyone can read it. Restricting it to your own HTTP
 * origins in the MapTiler console (Account → API Keys → allowed origins) is the only thing
 * standing between it and someone else's quota bill. Rotating it is not a substitute for that.
 *
 * If MapTiler ever answers 401/403/429 — wrong origin, revoked key, quota gone — the map falls
 * back to the baked OpenStreetMap basemap below rather than showing a grey void.
 */
const MAPTILER_KEY = "76SHjWmt9HL2JKQTuDoN";

/** Continent and ocean names on a map of four Melbourne suburbs. Suburb and street names stay. */
const LABELS_TO_HIDE = ["Ocean labels", "Sea labels", "Lakeline labels", "Country labels", "Continent labels", "State labels"];

const MAPLIBRE_JS = "vendor/maplibre-gl.js";
const MAPLIBRE_CSS = "vendor/maplibre-gl.css";

const { DROPOFF_SPOTS, mapsUrl } = window.KK;

const host = document.querySelector("[data-map]");
if (!host) return;

const canvas = host.querySelector("[data-map-canvas]");
const fallback = host.querySelector("[data-map-fallback]");

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function giveUp() {
  host.classList.add("map-unavailable");
  if (fallback) fallback.hidden = false;
}

/** Save-Data and 2G mean a 206 KB map library is an imposition, not a feature. */
const connection = navigator.connection;
if (connection?.saveData || /(^|\W)2g/.test(connection?.effectiveType || "")) {
  giveUp();
  return;
}

/* ---------- Style ---------- */

const BBOX = [
  [144.77, -37.83],
  [144.93, -37.72],
];

/**
 * Three widths, three greys, one label layer. A map that names every café is a map nobody reads
 * an address off; the shop names live in the list beside it.
 */
const localStyle = {
  version: 8,
  glyphs: "img/font/{fontstack}/{range}.pbf",
  sources: {
    roads: { type: "geojson", data: "img/roads.geojson" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0a0a" } },
    {
      id: "roads-minor",
      type: "line",
      source: "roads",
      filter: ["==", ["get", "r"], 3],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#1d1d1d",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 2],
      },
    },
    {
      id: "roads-mid",
      type: "line",
      source: "roads",
      filter: ["==", ["get", "r"], 2],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#303030",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 15, 3.4],
      },
    },
    {
      id: "roads-major",
      type: "line",
      source: "roads",
      filter: ["==", ["get", "r"], 1],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#4c4c4c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 15, 5],
      },
    },
    {
      id: "road-labels",
      type: "symbol",
      source: "roads",
      filter: ["all", ["has", "n"], ["<=", ["get", "r"], 2]],
      minzoom: 11.5,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "n"],
        "text-font": ["NotoSans"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 9.5, 15, 12],
        "text-letter-spacing": 0.06,
        "text-max-angle": 32,
        "symbol-spacing": 260,
      },
      paint: {
        "text-color": "#8b8b8b",
        "text-halo-color": "#050505",
        "text-halo-width": 1.3,
      },
    },
  ],
};

const maptilerStyle = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
const style = MAPTILER_KEY ? maptilerStyle : localStyle;

/* ---------- Selection, shared with the list ---------- */

const markers = new Map();
let selected = null;
let map = null;

function select(id, { fly = true, scrollCard = true } = {}) {
  selected = id;

  markers.forEach((marker, spotId) => {
    marker.getElement().firstChild.classList.toggle("is-active", spotId === id);
    marker.getElement().firstChild.setAttribute("aria-pressed", String(spotId === id));
  });

  document.querySelectorAll("[data-spot-id]").forEach((card) => {
    const active = card.dataset.spotId === id;
    card.classList.toggle("is-active", active);
    if (active && scrollCard) card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
  });

  const spot = DROPOFF_SPOTS.find((s) => s.id === id);
  if (!spot || !map || !fly) return;

  const target = { center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 13.6) };
  if (reducedMotion()) map.jumpTo(target);
  else map.flyTo({ ...target, duration: 900, essential: true });
}

// A card click selects, unless the click was on one of its two links.
document.addEventListener("click", (event) => {
  const card = event.target.closest("[data-spot-id]");
  if (!card || event.target.closest("a")) return;
  select(card.dataset.spotId, { scrollCard: false });
});

/* ---------- Build ---------- */

const loadOnce = (tag, attrs) =>
  new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement(tag), attrs);
    el.onload = resolve;
    el.onerror = () => reject(new Error(`failed to load ${attrs.src || attrs.href}`));
    document.head.appendChild(el);
  });

async function build() {
  try {
    await Promise.all([
      loadOnce("link", { rel: "stylesheet", href: MAPLIBRE_CSS }),
      loadOnce("script", { src: MAPLIBRE_JS }),
    ]);
  } catch {
    giveUp();
    return;
  }

  if (!window.maplibregl) {
    giveUp();
    return;
  }

  map = new maplibregl.Map({
    container: canvas,
    style,
    // Only the baked basemap has an edge to fall off.
    maxBounds: MAPTILER_KEY ? undefined : BBOX,
    minZoom: 10,
    maxZoom: MAPTILER_KEY ? 18 : 15.5,
    dragRotate: false,
    pitchWithRotate: false,
    // MapTiler's own style carries its attribution; the baked basemap carries none of its own.
    attributionControl: {
      compact: true,
      customAttribution: MAPTILER_KEY ? "" : "© OpenStreetMap contributors",
    },
  });

  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  let fellBack = false;

  map.on("error", (event) => {
    // A missing glyph range is a warning, not a reason to tear the map down.
    if (String(event.error?.message || "").includes("font")) return;

    // Wrong origin, revoked key, exhausted quota: keep the map, lose the provider.
    const status = event.error?.status;
    if (MAPTILER_KEY && !fellBack && [401, 403, 429].includes(status)) {
      fellBack = true;
      host.dataset.basemap = "local";
      map.setStyle(localStyle);
      map.setMaxBounds(BBOX);
      map.setMaxZoom(15.5);
      return;
    }

    if (!fellBack) giveUp();
  });

  map.on("load", () => {
    host.classList.add("map-ready");
    // `load` fires after the *current* style settles, which may be the fallback one. Recomputing
    // this from MAPTILER_KEY here clobbered the flag the error handler had just set.
    host.dataset.basemap = !fellBack && MAPTILER_KEY ? "maptiler" : "local";

    if (MAPTILER_KEY && !fellBack) {
      LABELS_TO_HIDE.forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      });
    }

    DROPOFF_SPOTS.forEach((spot) => {
      const wrapper = document.createElement("div");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `map-pin${spot.mainStore ? " map-pin--main" : ""}`;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${spot.name}, ${spot.address}`);
      button.innerHTML = '<span class="map-pin-dot" aria-hidden="true"></span>';
      wrapper.appendChild(button);

      const popup = new maplibregl.Popup({ offset: 18, closeButton: false, className: "map-popup" }).setHTML(`
        <strong>${spot.venue}</strong>
        <span>${spot.address}</span>
        <a class="secondary-button" href="${mapsUrl(spot)}" target="_blank" rel="noreferrer">Open in Google Maps</a>
      `);

      const marker = new maplibregl.Marker({ element: wrapper }).setLngLat([spot.lng, spot.lat]).setPopup(popup).addTo(map);
      markers.set(spot.id, marker);

      button.addEventListener("click", () => select(spot.id, { fly: true }));
    });

    const bounds = new maplibregl.LngLatBounds();
    DROPOFF_SPOTS.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding: 70, duration: 0, maxZoom: 13.4 });
  });
}

/* ---------- Only when it is nearly on screen ---------- */

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      build();
    },
    { rootMargin: "400px" },
  );
  io.observe(host);
} else {
  build();
}

})();
