/**
 * Single source of truth for KENZ KLEAN pricing, packages and brand contact.
 * Every figure here is transcribed from the printed price card (info.png).
 * Nothing on the site may hardcode a price — read it from this file.
 *
 * Prices are AUD and GST-inclusive, as required for consumer pricing in Australia.
 * Do not add GST on top at checkout; show it as a component of the total.
 *
 * Wrapped in an IIFE because the page scripts destructure these same names off
 * window.KK, and two classic scripts share one global lexical scope.
 */
(() => {

const BRAND = {
  name: "KENZ KLEAN",
  tagline: "Sneaker Cleaning",
  site: "www.kenzklean.com.au",
  phone: "0482 676 789",
  phoneHref: "tel:+61482676789",
  email: "support@kenzklean.com.au",
  instagram: "https://instagram.com/kenzklean",
  youtube: "https://youtube.com/@kenzklean",
  tiktok: "https://tiktok.com/@kenzklean",
  // Facebook appears on the printed price card but not in the live site footer.
  facebook: "https://facebook.com/kenzklean",
  city: "Melbourne, VIC, Australia",
  /**
   * The live site advertises "one of our 10 locations" but publishes only four addresses.
   * Keep the claim and the list in separate fields so the copy never silently drifts from
   * DROPOFF_SPOTS.length. Publish the remaining six, or lower this number.
   */
  advertisedLocations: 10,
};

/** GST is included in every displayed price. AU rate is 10%, so the component is total / 11. */
const GST_DIVISOR = 11;

/**
 * ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 * │  THE PRICE LIST — the one place any price is edited.                                       │
 * │                                                                                            │
 * │  Change a `price` here and it flows everywhere on next load: the package cards, the live   │
 * │  quote, the booking totals, and the search-engine / AI structured data (seo.js reads       │
 * │  these same numbers, so Google and the FAQ schema never fall out of step). No price is      │
 * │  hard-coded in any HTML file. A future admin panel writes to exactly this array.            │
 * │                                                                                            │
 * │  Transcribed from the printed price card (info.png). Prices are AUD, per pair, GST-incl.    │
 * └─────────────────────────────────────────────────────────────────────────────────────────┘
 */
const SERVICES = [
  {
    id: "basic",
    name: "Basic Clean",
    price: 55,
    summary: "Everyday sneakers that just need a reset.",
    includes: ["Full exterior clean", "Lace clean"],
    badge: null,
  },
  {
    id: "deep",
    name: "Deep Clean",
    price: 75,
    summary: "Worn-in pairs where the inside matters too.",
    includes: ["Everything in Basic Clean", "Insole clean", "Disinfecting"],
    badge: null,
  },
  {
    id: "ultimate",
    name: "Ultimate Clean",
    price: 95,
    summary: "Protected and sanitised, not just clean.",
    includes: ["Everything in Deep Clean", "Waterproofing", "Disinfecting"],
    badge: null,
  },
  {
    id: "restoration",
    name: "Restoration",
    price: 195,
    summary: "Full rebuild for pairs worth saving.",
    includes: [
      "Everything in Ultimate Clean",
      "Repainting",
      "Regluing",
      "Yellow sole whitening",
    ],
    badge: "Most complete",
  },
];

/**
 * Extras are per pair and cannot be bought on their own — the price card states
 * "Must be added to a cleaning service".
 *
 * `includedIn` lists the service ids that already bundle this extra. When one of
 * those services is selected the extra is shown as included and cannot be charged
 * again. Restoration bundles repaint, reglue and yellow sole whitening.
 */
const EXTRAS = [
  { id: "sole-protection", name: "Sole Protection", price: 40, includedIn: [] },
  { id: "yellow-sole-whitening", name: "Yellow Sole Whitening", price: 35, includedIn: ["restoration"] },
  { id: "reglue", name: "Reglue", price: 30, includedIn: ["restoration"] },
  { id: "full-repaint", name: "Full Repaint", price: 120, includedIn: ["restoration"] },
];

/**
 * Turnaround is a per-pair surcharge, not a property of the package.
 * `mainStoreOnly` on the 24-hour tier is a hard constraint from the price card:
 * both drop-off and pick-up must happen at the main store.
 */
const TURNAROUNDS = [
  {
    id: "standard",
    name: "Standard",
    price: 0,
    window: "3-5 business days",
    note: "Free return delivery to your home.",
    mainStoreOnly: false,
  },
  {
    id: "express",
    name: "Express",
    price: 10,
    window: "2-3 business days",
    note: "Free return delivery to your home.",
    mainStoreOnly: false,
  },
  {
    id: "rush",
    name: "24 Hour",
    price: 20,
    window: "24 hours",
    note: "Drop-off and pick-up at the main store only. No home delivery.",
    mainStoreOnly: true,
  },
];

/**
 * Transcribed from the live Locations page. Only `mainStore: true` carries behaviour
 * (the 24-hour turnaround requires it).
 *
 * The live site states two different sets of opening hours: the footer says Mon-Thu 10-6,
 * Fri-Sat 9-7, Sun 9-5, while the Locations page says Mon-Sat 9-5, Sun closed. The footer
 * hours are used below. Confirm which is current.
 *
 * Partner venues set their own hours, so we do not publish times we cannot vouch for.
 */
const MAIN_STORE_HOURS = "Mon-Thu 10am-6pm · Fri-Sat 9am-7pm · Sun 9am-5pm";
const PARTNER_HOURS = "Opening hours follow the partner venue";

/**
 * Coordinates were geocoded once from the street addresses (OpenStreetMap Nominatim, © OSM
 * contributors) rather than looked up at runtime — runtime geocoding costs money, adds latency,
 * and can silently drift.
 *
 * They point at the street address, not at the box. The box stands inside the venue, so expect
 * a few metres of error. Walk each one and correct it before you print anything that depends on
 * the pin being exact.
 */

const DROPOFF_SPOTS = [
  {
    id: "footscray",
    lat: -37.799847,
    lng: 144.898939,
    name: "KENZ KLEAN Main Store",
    venue: "Kenzo Barber Crew",
    address: "163 Barkly St, Footscray VIC 3011",
    suburb: "Footscray",
    hours: MAIN_STORE_HOURS,
    mainStore: true,
  },
  {
    id: "sunshine-west-avenue",
    lat: -37.797613,
    lng: 144.806142,
    name: "Drop-off Spot - Sunshine West",
    venue: "WestGate Barbers",
    address: "Shop 5/136 The Avenue, Sunshine West VIC 3020",
    suburb: "Sunshine West",
    hours: PARTNER_HOURS,
    mainStore: false,
  },
  {
    id: "sunshine-west-fairbairn",
    lat: -37.804679,
    lng: 144.819214,
    name: "Drop-off Spot - Sunshine West",
    venue: "The Room - Pickleball",
    address: "112 Fairbairn Rd, Sunshine West VIC 3020",
    suburb: "Sunshine West",
    hours: PARTNER_HOURS,
    mainStore: false,
  },
  {
    id: "st-albans",
    lat: -37.744345,
    lng: 144.802705,
    name: "Drop-off Spot - St Albans",
    venue: "Cafe 286",
    address: "286 Main Rd E, St Albans VIC 3021",
    suburb: "St Albans",
    hours: PARTNER_HOURS,
    mainStore: false,
  },
];

/**
 * A directions link, not a search. The destination is the geocoded point rather than the address
 * string, so Google drops the pin where we mean instead of where it parses "Shop 5/136 The
 * Avenue" to. Google reverse-geocodes the label itself.
 */
const mapsUrl = (spot) => `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

const findService = (id) => SERVICES.find((s) => s.id === id) || SERVICES[0];
const findTurnaround = (id) => TURNAROUNDS.find((t) => t.id === id) || TURNAROUNDS[0];
const isExtraIncluded = (extra, serviceId) => extra.includedIn.includes(serviceId);

const formatAud = (amount) =>
  `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Extras bundled into the chosen service are dropped rather than charged twice.
 * Every line is multiplied by the number of pairs.
 */
function quote({ serviceId, extraIds = [], turnaroundId, pairs = 1 }) {
  const service = findService(serviceId);
  const turnaround = findTurnaround(turnaroundId);
  const chargeable = EXTRAS.filter(
    (extra) => extraIds.includes(extra.id) && !isExtraIncluded(extra, service.id),
  );

  const lines = [
    { label: service.name, unit: service.price, pairs },
    ...chargeable.map((extra) => ({ label: extra.name, unit: extra.price, pairs })),
  ];

  if (turnaround.price > 0) {
    lines.push({ label: `${turnaround.name} turnaround`, unit: turnaround.price, pairs });
  }

  const total = lines.reduce((sum, line) => sum + line.unit * line.pairs, 0);

  return {
    service,
    turnaround,
    extras: chargeable,
    lines,
    total,
    gst: total / GST_DIVISOR,
  };
}

window.KK = {
  BRAND,
  SERVICES,
  EXTRAS,
  TURNAROUNDS,
  DROPOFF_SPOTS,
  findService,
  findTurnaround,
  isExtraIncluded,
  formatAud,
  mapsUrl,
  quote,
};

})();
