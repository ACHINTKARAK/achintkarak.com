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
      "#ak-analytics-panel[hidden], #ak-analytics-details[hidden] {",
      "  display: none !important;",
      "}",
      "#ak-analytics-panel {",
      "  position: fixed; z-index: 9999; bottom: 1rem;",
      "  left: 1rem; right: 1rem; width: auto; max-width: 610px;",
      "  margin: 0 auto; padding: 1.15rem 1.35rem;",
      "  color: var(--text, #161616); background: var(--bg, #fff);",
      "  border: 1px solid var(--hair, #777);",
      "  box-shadow: 0 4px 26px #0002; font: inherit; line-height: 1.55;",
      "  max-height: min(85vh, 680px); overflow-y: auto;",
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
      "#ak-analytics-actions button, #ak-analytics-save {",
      "  flex: 1 1 155px; padding: .5rem .65rem; cursor: pointer;",
      "  font: inherit; font-size: .82rem; line-height: 1.5;",
      "  color: inherit; background: transparent;",
      "  border: 1px solid var(--text, #161616); border-radius: 2px;",
      "}",
      "#ak-analytics-panel button:hover { background: var(--card, #eee); }",
      "#ak-analytics-panel button:focus-visible,",
      "#ak-analytics-preferences:focus-visible {",
      "  outline: 2px solid currentColor; outline-offset: 3px;",
      "}",
      "#ak-analytics-details {",
      "  margin-top: .95rem; padding-top: .85rem;",
      "  border-top: 1px solid var(--hair, #777);",
      "}",
      "#ak-analytics-details .ak-choice {",
      "  display: flex; gap: .6rem; align-items: flex-start;",
      "  padding: .5rem 0; font-size: .88rem;",
      "}",
      "#ak-analytics-details .ak-choice input { margin-top: .3rem; }",
      "#ak-analytics-details .ak-choice strong { display: block; }",
      "#ak-analytics-details .ak-choice small {",
      "  display: block; color: var(--muted, #777); font-size: .78rem;",
      "}",
      "#ak-analytics-save { display: block; width: 100%; margin-top: .75rem; }",
      "#ak-analytics-preferences {",
      "  display: inline-block; margin: .6rem auto 0; padding: .15rem;",
      "  color: inherit; font: inherit; font-size: .75rem; opacity: .65;",
      "  text-decoration: underline; text-underline-offset: .15rem;",
      "}",
      "#ak-analytics-preferences:hover { opacity: 1; }",
      "#ak-analytics-details .ak-disclosure {",
      "  margin: .7rem 0 0; color: var(--muted, #777); font-size: .78rem;",
      "}"
    ].join("\n");
    document.head.appendChild(css);

    const footer = document.querySelector("footer");
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
      "You can accept, reject or manage optional uses.";
    panel.appendChild(description);

    const actions = document.createElement("div");
    actions.id = "ak-analytics-actions";

    function button(label) {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      actions.appendChild(element);
      return element;
    }

    const allow = button("Accept analytics");
    const reject = button("Reject optional");
    const manage = button("Manage choices");
    panel.appendChild(actions);

    const details = document.createElement("div");
    details.id = "ak-analytics-details";
    details.hidden = true;

    function category(title, descriptionText, selectable) {
      const row = document.createElement("label");
      row.className = "ak-choice";
      const field = document.createElement("input");
      field.type = "checkbox";
      field.checked = false; // Optional processing is never preselected.
      field.disabled = !selectable;
      const content = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = title;
      const explanation = document.createElement("small");
      explanation.textContent = descriptionText;
      content.appendChild(name);
      content.appendChild(explanation);
      row.appendChild(field);
      row.appendChild(content);
      details.appendChild(row);
      return field;
    }

    const essential = category(
      "Essential — always active",
      "Keeps basic website functionality and remembers your privacy choice.",
      false
    );
    essential.checked = true;

    const analytics = category(
      "Audience analytics — optional",
      "Google Analytics measures visited pages and album-link clicks. " +
      "Google may process standard technical information; see Privacy details.",
      true
    );

    category(
      "Advertising and personalisation — not used",
      ADVERTISING_ACTIVE
        ? "Will require its own informed consent before any advertising code runs."
        : "No advertising tracking is active. If introduced, you will be " +
          "asked separately before it starts.",
      false
    );

    const disclosure = document.createElement("p");
    disclosure.className = "ak-disclosure";
    disclosure.textContent =
      "If you accept audience analytics, Google may use analytics cookies " +
      "and process standard technical information such as browser details and " +
      "approximate location. I do not intentionally send names, email addresses " +
      "or form contents. Previous analytics data is not automatically deleted " +
      "if you later withdraw permission. Your choice is remembered in this " +
      "browser for 180 days.";
    details.appendChild(disclosure);

    const googlePrivacy = document.createElement("a");
    googlePrivacy.href = "https://policies.google.com/privacy";
    googlePrivacy.target = "_blank";
    googlePrivacy.rel = "noopener noreferrer";
    googlePrivacy.textContent = "Google privacy policy";
    details.appendChild(googlePrivacy);

    const save = document.createElement("button");
    save.type = "button";
    save.id = "ak-analytics-save";
    save.textContent = "Save my choices";
    details.appendChild(save);
    panel.appendChild(details);

    function showPreferences() {
      const current = preference();
      analytics.checked = !!(current && current.analytics);
      details.hidden = false;
      manage.setAttribute("aria-expanded", "true");
      analytics.focus();
    }

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
        // A running Google script cannot be reliably unloaded without reload.
        if (wasEnabled) location.reload();
      }
    }

    allow.addEventListener("click", function () { applyChoice(true); });
    reject.addEventListener("click", function () { applyChoice(false); });
    manage.addEventListener("click", showPreferences);
    save.addEventListener("click", function () {
      applyChoice(analytics.checked === true);
    });

    document.body.appendChild(panel);
    panel.hidden = preference() !== null;

    if (footer) {
      // A low-profile footer link is available for withdrawal at any time,
      // without leaving a permanent consent button on the photo journal.
      const preferences = document.createElement("a");
      preferences.id = "ak-analytics-preferences";
      preferences.href = "#privacy-choices";
      preferences.textContent = "Privacy";
      footer.appendChild(preferences);
      preferences.addEventListener("click", function (event) {
        event.preventDefault();
        panel.hidden = false;
        showPreferences();
      });
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
