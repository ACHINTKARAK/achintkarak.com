/* Achint Karak Photo Journal — optional, consent-first Google Analytics 4.
 * Isolated from site.js and the website's image and navigation logic.
 * Google scripts are NEVER requested unless a visitor actively accepts.
 */
(function () {
  "use strict";

  const MEASUREMENT_ID = "G-KYQZZZVGXB";
  // Privacy decisions are kept in the visitor's browser, never in the repo.
  // Change this version only if the purposes or recipients materially change.
  const CONSENT_KEY = "ak_privacy_choices_v2";
  const POLICY_VERSION = 2;
  const MAX_CONSENT_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  // Reserved for a future, independently consented advertising integration.
  // Google advertising consent always stays DENIED in this analytics-only build.
  const ADVERTISING_ACTIVE = false;
  const GOOGLE_TAG_URL = "https://www.googletagmanager.com/gtag/js?id=";
  let tagStarted = false;

  function preference() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== POLICY_VERSION ||
          typeof saved.analytics !== "boolean" ||
          !Number.isFinite(saved.timestamp) ||
          saved.timestamp > Date.now() ||
          Date.now() - saved.timestamp > MAX_CONSENT_AGE_MS) {
        return null;
      }
      return saved;
    } catch (error) {
      // If storage is disabled, we ask rather than assume consent.
      return null;
    }
  }

  function savePreference(analytics) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        version: POLICY_VERSION,
        analytics: analytics === true,
        advertising: false, // No ad tracking is in use.
        timestamp: Date.now()
      }));
    } catch (error) {
      // Storage disabled: the site still works; analytics won't be enabled
      // unless the visitor has explicitly opted in in this session.
    }
  }

  function hasAnalyticsConsent() {
    const saved = preference();
    return !!(saved && saved.analytics === true);
  }

  function cleanPageUrl() {
    // Never pass query strings or fragments to Analytics.
    return location.origin + location.pathname;
  }

  function enableAnalytics() {
    if (tagStarted || window["ga-disable-" + MEASUREMENT_ID]) {
      return;
    }
    // Don't count local developer previews or file:// viewing.
    if (location.protocol !== "https:" ||
        !["achintkarak.com", "www.achintkarak.com"].includes(location.hostname)) {
      return;
    }

    tagStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    // Consent Mode v2; advertising stays disabled even with analytics consent.
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("js", new Date());
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("config", MEASUREMENT_ID, {
      page_location: cleanPageUrl(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const googleTag = document.createElement("script");
    googleTag.async = true;
    googleTag.src = GOOGLE_TAG_URL + encodeURIComponent(MEASUREMENT_ID);
    googleTag.onerror = function () {
      // Ad blockers or connectivity problems must not affect the journal.
    };
    document.head.appendChild(googleTag);
    beginPhotoProgressTracking();
  }

  function beginPhotoProgressTracking() {
    // Only on album pages, only after active analytics consent.
    // These are reached-in-view checkpoints, not proof someone studied a photo.
    if (!("IntersectionObserver" in window)) return;
    if (!/^\/journal\/\d{4}-\d{2}\/[a-z0-9-]+\/?$/.test(location.pathname)) {
      return;
    }

    const checkpoints = new Set(["1", "3", "5", "7"]);
    const photos = Array.from(
      document.querySelectorAll("figure.frame[data-ak-photo-number]")
    ).filter(function (figure) {
      return checkpoints.has(figure.getAttribute("data-ak-photo-number"));
    });
    if (photos.length === 0) return;

    const seen = new Set();
    const observer = new IntersectionObserver(function (entries) {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const photoNumber = entry.target.getAttribute("data-ak-photo-number");
        observer.unobserve(entry.target);
        if (!photoNumber || seen.has(photoNumber)) continue;
        seen.add(photoNumber);
        if (!hasAnalyticsConsent() || typeof window.gtag !== "function") continue;
        window.gtag("event", "photo_progress", {
          album_path: location.pathname,
          photo_checkpoint: photoNumber
        });
      }
    }, { rootMargin: "0px 0px -35% 0px", threshold: 0 });

    photos.forEach(function (photo) { observer.observe(photo); });
  }

  function clearAnalyticsCookies() {
    try {
      const names = document.cookie.split(";")
        .map(function (value) { return value.split("=")[0].trim(); })
        .filter(function (name) { return /^_ga(?:_|$)/.test(name); });
      for (const name of names) {
        document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax";
        if (location.hostname === "achintkarak.com" ||
            location.hostname.endsWith(".achintkarak.com")) {
          document.cookie = name +
            "=; Max-Age=0; Path=/; Domain=.achintkarak.com; SameSite=Lax";
        }
      }
    } catch (error) {
      // Best-effort cookie removal.
    }
  }

  function createUI() {
    // All analytics controls are separate from the journal's core functionality.
    // The consent notice is shown only when no valid 180-day choice is stored.
    const css = document.createElement("style");
    css.textContent = [
      "#ak-analytics-panel[hidden] { display: none !important; }",
      "#ak-analytics-panel {",
      "  position: fixed; z-index: 9999; bottom: 1rem;",
      "  left: 1rem; right: 1rem; max-width: 610px;",
      "  margin: 0 auto; padding: 1.15rem 1.35rem;",
      "  color: var(--text, #161616); background: var(--bg, #fff);",
      "  border: 1px solid var(--hair, #777); box-shadow: 0 4px 26px #0002;",
      "  font: inherit; line-height: 1.55;",
      "  max-height: 85vh; overflow-y: auto;",
      "}",
      "#ak-analytics-panel h2 {",
      "  color: inherit; font: inherit; font-size: 1.05rem;",
      "  font-weight: 600; margin: 0 0 .45rem;",
      "}",
      "#ak-analytics-panel p { margin: 0 0 .75rem; font-size: .88rem; }",
      "#ak-analytics-panel a { color: inherit; text-decoration: underline; }",
      "#ak-analytics-actions {",
      "  display: flex; flex-wrap: wrap; gap: .55rem; margin-top: .9rem;",
      "}",
      "#ak-analytics-actions button {",
      "  flex: 1 1 190px; padding: .5rem .65rem; cursor: pointer;",
      "  font: inherit; font-size: .82rem; line-height: 1.5;",
      "  color: inherit; background: transparent;",
      "  border: 1px solid var(--text, #161616); border-radius: 2px;",
      "}",
      "#ak-analytics-actions button:hover { background: var(--card, #eee); }",
      "#ak-analytics-actions button:focus-visible {",
      "  outline: 2px solid currentColor; outline-offset: 3px;",
      "}"
    ].join("\n");
    document.head.appendChild(css);

    const panel = document.createElement("section");
    panel.id = "ak-analytics-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", "ak-privacy-title");

    const heading = document.createElement("h2");
    heading.id = "ak-privacy-title";
    heading.textContent = "A note on privacy";
    panel.appendChild(heading);

    const description = document.createElement("p");
    description.textContent =
      "This journal works without tracking. With your permission, " +
      "Google Analytics helps me understand which pages and photo albums " +
      "people explore, so I can improve and share the journal. " +
      "Google may use analytics cookies and process technical data.";
    panel.appendChild(description);

    const detailsLink = document.createElement("a");
    detailsLink.href = "/privacy/";
    detailsLink.textContent = "How analytics works";
    panel.appendChild(detailsLink);

    const actions = document.createElement("div");
    actions.id = "ak-analytics-actions";

    const allow = document.createElement("button");
    allow.type = "button";
    allow.textContent = "Accept analytics";

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Reject optional";

    actions.appendChild(allow);
    actions.appendChild(reject);
    panel.appendChild(actions);
    document.body.appendChild(panel);
    panel.hidden = preference() !== null;

    function applyChoice(analyticsAllowed) {
      const wasEnabled = tagStarted;
      savePreference(analyticsAllowed);
      panel.hidden = true;
      if (analyticsAllowed) {
        window["ga-disable-" + MEASUREMENT_ID] = false;
        enableAnalytics();
      } else {
        window["ga-disable-" + MEASUREMENT_ID] = true;
        if (typeof window.gtag === "function") {
          window.gtag("consent", "update", { analytics_storage: "denied" });
        }
        clearAnalyticsCookies();
        // An already-loaded Google tag cannot be unloaded without a reload.
        if (wasEnabled) location.reload();
      }
    }

    allow.addEventListener("click", function () { applyChoice(true); });
    reject.addEventListener("click", function () { applyChoice(false); });

    // Privacy controls remain accessible from the standalone Privacy page,
    // never from the journal's footer or photographs.
    const reopen = document.getElementById("ak-open-privacy");
    if (reopen) {
      reopen.addEventListener("click", function () {
        panel.hidden = false;
        allow.focus();
      });
    }
    const withdraw = document.getElementById("ak-withdraw-privacy");
    if (withdraw) {
      withdraw.addEventListener("click", function () { applyChoice(false); });
    }
  }

  function trackAlbumClicks(event) {
    if (!hasAnalyticsConsent() || !tagStarted || typeof window.gtag !== "function") {
      return;
    }
    const target = event.target;
    const anchor = target && target.closest ? target.closest("a[href]") : null;
    if (!anchor) return;

    let destination;
    try { destination = new URL(anchor.href, location.href); }
    catch (error) { return; }
    if (destination.origin !== location.origin) return;
    const albumPath = /^\/journal\/\d{4}-\d{2}\/[a-z0-9-]+\/?$/;
    if (!albumPath.test(destination.pathname)) return;

    window.gtag("event", "album_open", {
      album_path: destination.pathname,
      source_path: location.pathname,
      transport_type: "beacon"
    });
  }

  function initialize() {
    try {
      createUI();
      if (hasAnalyticsConsent()) {
        enableAnalytics();
      }
      document.addEventListener("click", trackAlbumClicks, true);
    } catch (error) {
      // Analytics is optional: never interrupt photographs or navigation.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
