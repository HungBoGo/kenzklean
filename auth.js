/**
 * ⚠️  PROTOTYPE AUTHENTICATION — NOT SECURITY.
 *
 * There is no backend. Accounts, sessions and orders live in this browser's localStorage,
 * where anyone with DevTools can read or forge them. Gating the tracking page here shapes the
 * user experience; it protects nothing. Do not put real customer data behind it.
 *
 * The real thing is specified in ARCHITECTURE_SECURITY.md: HttpOnly session cookies, server-side
 * authorization on every order lookup, rate-limited OTP endpoints. When that lands, this module
 * is replaced wholesale — every caller goes through the four functions exported at the bottom,
 * so the swap is contained.
 *
 * No password is stored, deliberately. The flow mirrors the phone-OTP login the roadmap chose,
 * and a fake password field would teach the wrong habit.
 */
(() => {

const USERS_KEY = "kk-users";
const SESSION_KEY = "kk-session";
const ORDERS_KEY = (email) => `kk-orders-${email}`;

const CODE_TTL_MS = 5 * 60 * 1000;

/** Held in memory only. A real OTP never reaches the client, let alone its storage. */
let pending = null;

const normaliseEmail = (email) => email.trim().toLowerCase();

/** localStorage throws on opaque origins (file://) and in some private modes. */
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const allUsers = () => readJson(USERS_KEY, {});

function findUser(email) {
  return allUsers()[normaliseEmail(email)] || null;
}

/* ---------- Session ---------- */

function currentUser() {
  const email = readJson(SESSION_KEY, null);
  return email ? findUser(email) : null;
}

function signIn(email) {
  writeJson(SESSION_KEY, normaliseEmail(email));
  return currentUser();
}

function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
  pending = null;
}

/* ---------- Register ---------- */

function register({ fullName, email, mobile }) {
  const key = normaliseEmail(email);
  const users = allUsers();

  if (users[key]) {
    return { ok: false, error: "An account already exists for that email. Log in instead." };
  }

  users[key] = { fullName: fullName.trim(), email: key, mobile: mobile.trim(), createdAt: new Date().toISOString() };

  if (!writeJson(USERS_KEY, users)) {
    return { ok: false, error: "Your browser is blocking storage, so we cannot create an account here." };
  }

  return { ok: true, user: signIn(key) };
}

/* ---------- Log in ---------- */

/**
 * Returns the code so the demo UI can display it. A real implementation sends it out of band
 * and returns nothing but an acknowledgement.
 */
function requestCode(email) {
  const user = findUser(email);
  if (!user) {
    return { ok: false, error: "No account for that email. Create one below." };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  pending = { email: user.email, code, expiresAt: Date.now() + CODE_TTL_MS };

  return { ok: true, code, user };
}

function verifyCode(code) {
  if (!pending) {
    return { ok: false, error: "Request a new code." };
  }
  if (Date.now() > pending.expiresAt) {
    pending = null;
    return { ok: false, error: "That code has expired. Request a new one." };
  }
  if (code.trim() !== pending.code) {
    return { ok: false, error: "That code is not right. Check it and try again." };
  }

  const email = pending.email;
  pending = null;
  return { ok: true, user: signIn(email) };
}

/* ---------- Orders ---------- */

function saveOrder(order) {
  const user = currentUser();
  if (!user) return false;

  const orders = readJson(ORDERS_KEY(user.email), []);
  orders.unshift(order);
  return writeJson(ORDERS_KEY(user.email), orders);
}

function myOrders() {
  const user = currentUser();
  return user ? readJson(ORDERS_KEY(user.email), []) : [];
}

function findMyOrder(code) {
  const wanted = code.trim().toUpperCase();
  return myOrders().find((order) => order.code === wanted) || null;
}

window.KKAuth = {
  currentUser,
  register,
  requestCode,
  verifyCode,
  signOut,
  saveOrder,
  myOrders,
  findMyOrder,
};

})();
