/* Achint Karak Photo Journal — optional, consent-first Google Analytics 4.
 * Isolated from site.js and the website's image and navigation logic.
 * Google scripts are NEVER requested unless a visitor actively accepts.
 */
(function () {
  "use strict";

  const MEASUREMENT_ID = "G-KYQZZZVGXB";
  const CONSENT_KEY = "ak_analytics_consent_v1";
  const GOOGLE_TAG_URL = "https://www.googletagmanager.com/gtag/js?id=";
  let tagStarted = false;

  function preference() {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      return saved === "accepted" || saved === "declined" ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function savePreference(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (error) {
      // A blocked storage API must never interrupt the journal.
    }
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
    const css = document.createElement("style");
    css.textContent = [
      "#ak-analytics-panel[hidden] { display: none !important; }",
      "#ak-analytics-panel {",
      "  position: fixed; z-index: 9999; bottom: 1rem; left: 1rem; right: 1rem;",
      "  max-width: 560px; margin: 0 auto; padding: 1rem 1.15rem;",
      "  color: var(--text, #222); background: var(--bg, #fff);",
      "  border: 1px solid currentColor; box-shadow: 0 3px 20px #0002;",
      "  font: inherit; line-height: 1.5;",
      "}",
      "#ak-analytics-panel p { margin: 0 0 .8rem; font-size: .92rem; }",
      "#ak-analytics-panel a { color: inherit; text-decoration: underline; }",
      "#ak-analytics-choices { display: flex; flex-wrap: wrap; gap: .65rem; }",
      "#ak-analytics-choices button {",
      "  font: inherit; color: inherit; background: transparent;",
      "  border: 1px solid currentColor; border-radius: 2px;",
      "  padding: .35rem .7rem; cursor: pointer;",
      "}",
      "#ak-analytics-choices button:focus-visible,",
      "#ak-analytics-preferences:focus-visible {",
      "  outline: 2px solid currentColor; outline-offset: 3px;",
      "}",
      "#ak-analytics-preferences {",
      "  display: block; margin: .6rem auto 0; padding: .15rem;",
      "  color: inherit; background: transparent; border: 0; cursor: pointer;",
      "  font: inherit; font-size: .78rem; opacity: .8; text-decoration: underline;",
      "}"
    ].join("\n");
    document.head.appendChild(css);

    const footer = document.querySelector("footer");
    let panel;

    if (footer) {
      const preferences = document.createElement("button");
      preferences.id = "ak-analytics-preferences";
      preferences.type = "button";
      preferences.textContent = "Analytics preferences";
      footer.appendChild(preferences);
      preferences.addEventListener("click", function () {
        panel.hidden = false;
        panel.querySelector("button").focus();
      });
    }

    panel = document.createElement("section");
    panel.id = "ak-analytics-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Optional website analytics");

    const description = document.createElement("p");
    description.appendChild(document.createTextNode(
      "May I use Google Analytics to see which photo albums are viewed? " +
      "Google may set analytics cookies if you accept. The journal works either way. "
    ));
    const details = document.createElement("a");
    details.href = "/about/";
    details.textContent = "Privacy details";
    description.appendChild(details);
    panel.appendChild(description);

    const buttons = document.createElement("div");
    buttons.id = "ak-analytics-choices";
    const decline = document.createElement("button");
    decline.type = "button";
    decline.textContent = "Decline";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept analytics";
    buttons.appendChild(decline);
    buttons.appendChild(accept);
    panel.appendChild(buttons);
    document.body.appendChild(panel);
    panel.hidden = preference() !== null;

    accept.addEventListener("click", function () {
      savePreference("accepted");
      panel.hidden = true;
      window["ga-disable-" + MEASUREMENT_ID] = false;
      enableAnalytics();
    });
    decline.addEventListener("click", function () {
      const wasAccepted = preference() === "accepted";
      savePreference("declined");
      panel.hidden = true;
      window["ga-disable-" + MEASUREMENT_ID] = true;
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "denied" });
      }
      clearAnalyticsCookies();
      // Removing an already-running tag reliably requires a fresh document.
      if (wasAccepted && tagStarted) {
        location.reload();
      }
    });
  }

  function trackAlbumClicks(event) {
    if (preference() !== "accepted" || !tagStarted || typeof window.gtag !== "function") {
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
      if (preference() === "accepted") {
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
