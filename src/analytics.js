// Optional GA4 measurement. No Google code loads until the player opts in.
export const MEASUREMENT_ID = "G-TH3S8LDGPQ";
export const CONSENT_KEY = "borrowed-light:analytics-choice:v1";
const CANONICAL = "https://fanndu.github.io/borrowed-light/";
const events = new Set([
  "game_started",
  "level_started",
  "level_completed",
  "hint_requested",
  "puzzle_failed",
]);
export function attribution(href, referrer = "") {
  const url = new URL(href);
  let source = url.searchParams.get("utm_source");
  if (!["x", "itch", "playtest"].includes(source)) {
    try {
      const host = new URL(referrer).hostname;
      source = /(^|\.)itch\.io$/.test(host)
        ? "itch"
        : /^(t\.co|x\.com|twitter\.com)$/.test(host)
          ? "x"
          : "direct";
    } catch {
      source = "direct";
    }
  }
  return {
    campaign_source: source,
    campaign_medium:
      source === "direct" ? "none" : source === "itch" ? "referral" : "social",
    campaign_name: source === "direct" ? "organic" : "first_playtest",
  };
}
export function safeEvent(name, values = {}) {
  if (!events.has(name)) return null;
  const result = {};
  for (const key of ["level_id", "chapter", "moves", "hints", "stars"]) {
    const value = values[key];
    if (Number.isInteger(value) && value >= 0 && value <= 1000000)
      result[key] = value;
  }
  if (typeof values.is_replay === "boolean")
    result.is_replay = values.is_replay;
  return result;
}
export function createAnalytics(win, id = MEASUREMENT_ID) {
  const doc = win.document,
    host = win.location.hostname;
  const available =
    /^G-[A-Z0-9]+$/.test(id) &&
    win.location.protocol === "https:" &&
    ((host === "fanndu.github.io" &&
      win.location.pathname.startsWith("/borrowed-light/")) ||
      /(^|\.)(itch\.zone|hwcdn\.net)$/.test(host));
  let consent = null,
    loaded = false,
    pageSent = false;
  const seen = new Set();
  try {
    const value = win.localStorage.getItem(CONSENT_KEY);
    consent = value === "yes" ? true : value === "no" ? false : null;
  } catch {}
  function send() {
    win.dataLayer.push(arguments);
  }
  function start() {
    if (!available || consent !== true) return;
    win["ga-disable-" + id] = false;
    if (!loaded) {
      loaded = true;
      win.dataLayer = win.dataLayer || [];
      send("consent", "default", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      send("js", new Date());
      send("config", id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_prefix: "bl",
        cookie_domain: host,
        cookie_expires: 60 * 24 * 3600,
        page_location: CANONICAL,
        page_referrer: "",
        ...attribution(win.location.href, doc.referrer),
        ...(new URL(win.location.href).searchParams.get("analytics_debug") ===
        "1"
          ? { debug_mode: true }
          : {}),
      });
      const script = doc.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
      doc.head.append(script);
    } else
      send("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    if (!pageSent) {
      pageSent = true;
      send("event", "page_view", {
        page_location: CANONICAL,
        page_title: "借光 · Borrowed Light",
        page_referrer: "",
      });
    }
  }
  function setConsent(value) {
    consent = value === true;
    try {
      win.localStorage.setItem(CONSENT_KEY, consent ? "yes" : "no");
    } catch {}
    if (consent) start();
    else {
      win["ga-disable-" + id] = true;
      // Remove only this game's analytics cookies; keep saves and other sites intact.
      for (const entry of doc.cookie.split(";")) {
        const name = entry.split("=")[0].trim();
        if (!/^bl_ga(?:_|$)/.test(name)) continue;
        for (const domain of ["", `; Domain=${host}`])
          doc.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }
  function track(name, values = {}, once = false) {
    const safe = safeEvent(name, values);
    if (!available || consent !== true || !safe) return false;
    const key = name + ":" + (safe.level_id ?? "");
    if (once && seen.has(key)) return false;
    seen.add(key);
    send("event", name, { ...safe, game_version: "1.0.1" });
    return true;
  }
  win.addEventListener?.("storage", (e) => {
    if (e.key === CONSENT_KEY && e.newValue !== "yes") setConsent(false);
  });
  start();
  return {
    get available() {
      return available;
    },
    get consent() {
      return consent;
    },
    setConsent,
    track,
  };
}
