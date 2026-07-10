# KENZ KLEAN

Sneaker cleaning and restoration, Melbourne VIC. Static marketing and booking site — no build
step, no framework, no bundler. Open `index.html` over HTTP and it runs.

**Live demo:** https://hungbogo.github.io/kenzklean/

## What this is, and is not

It is a front end. Every price, package and turnaround comes from `data.js`, transcribed once from
the printed price card, and nothing else hardcodes a figure. GST is *inside* the displayed prices,
as Australian consumer law requires; it is shown as a component of the total, never added on top.

It is **not** a backend. `auth.js` keeps accounts, sessions and orders in `localStorage`. The login
gate protects nothing and is not meant to — it exists to make the demo walkable. The promo signup
writes to `localStorage` and mails nobody. Both say so on screen.

## Files

| | |
|---|---|
| `data.js` | Prices, packages, turnarounds, drop-off spots. The single source of truth. |
| `script.js` | Landing page: renderers, the live quote, the scroll reveal. |
| `booking.js` | The four-step booking flow and its three business rules. |
| `map.js` | Drop-off map. MapTiler vector tiles, falling back to a baked OpenStreetMap basemap. |
| `compare.js` | The before/after hero slider. |
| `rail.js` | Auto-drifting horizontal rails on phones. |
| `anim.js` | GSAP + ScrollTrigger. Degrades to a static page if either fails to load. |

## Graceful degradation

Every optional dependency is optional. Without GSAP the page renders in place. Without MapLibre or
MapTiler the addresses are still text with directions links. Without `IntersectionObserver` nothing
hides. Without `localStorage` the booking flow still quotes. `prefers-reduced-motion` is honoured
in CSS *and* in JS.

## Third party

MapLibre GL JS (BSD-3) and GSAP (standard licence) are vendored in `vendor/`. Basemap data ©
OpenStreetMap contributors (ODbL). Glyphs are Noto Sans (OFL). The MapTiler key in `map.js` ships
in the page, as every browser key must — it is restricted by HTTP origin, which is the only
protection a static site can have.
