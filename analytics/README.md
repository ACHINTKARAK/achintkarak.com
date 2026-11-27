# Google Analytics 4 — optional, consent-first implementation

**GA4 Measurement ID:** `G-KYQZZZVGXB` (MyJournal web stream, achintkarak.com).

This feature is isolated from the journal's existing `site.js`, styling and page navigation. The only template modification is a deferred script tag. No generated HTML was changed in this branch.

## Behaviour

- Google Analytics is **not downloaded or initialized until someone selects “Accept analytics.”**
- On a visitor's first visit in a browser with no stored choice, a small consent notice appears with **Accept analytics** and **Only necessary** as equally prominent choices. The choice is remembered in that browser, so returning visitors are not repeatedly prompted.
- The choice is stored in this browser (localStorage); it is not itself transmitted to Google.
- Visitors who select **Only necessary** can browse and view photographs as normal. No Google Analytics scripts are requested until the visitor explicitly accepts.
- “Analytics preferences” remains available in each page footer to change the decision.
- When a user revokes acceptance, the script disables collection, attempts to remove `_ga` cookies, and reloads the document to unload the tag. Already-collected data is not deleted.
- The script records GA4 page views and a custom `album_open` event when an internal album link is selected. `album_path` and `source_path` are site paths, not personal data.
- The script deliberately excludes query strings, disables advertising personalization/signals and does not send tracking data in local previews.
- GA4 may still collect its standard analytics parameters from consenting visitors, subject to your GA4 settings.

## Deployment and testing

1. Review the draft PR before merging. **The live website stays untouched while this branch is unmerged.**
2. Pull this branch locally and run `./journal.ps1 check` (PowerShell) to validate the usual build, then `./journal.ps1 preview` to check layout and navigation.
3. On local preview, the consent control should display for a browser without a stored preference; GA4 does not actually load on localhost to avoid contaminating statistics. To simulate a first-time visitor after testing, use a fresh private window or clear the `ak_analytics_consent_v1` localStorage key.
4. After merging and rebuilding/deploying with your usual publishing process, visit `https://achintkarak.com` in a fresh browser session.
5. Before acceptance, check Network: **no requests to `googletagmanager.com` or `google-analytics.com`** from this integration.
6. Accept analytics; verify a Google tag request appears. Then check Google Analytics → Reports → Realtime (reporting can take some time).
7. Open an album and verify its page path appears. If you want custom click reporting, register `album_path` as an event-scoped custom dimension in GA4.
8. Test Decline and re-open the preferences button. Test on mobile and with blocked third-party scripts.

## Reverting

Revert the template additions and remove `analytics/ga4-consent.js`, then run the normal build. The journal's core JavaScript remains unchanged.

## Privacy notes

Google receives analytics data for visitors who opt in. The first-visit notice focuses on page and album viewing; the linked About privacy section accurately explains Google's additional default technical processing, including approximate location and browser/device information. Future advertising-related tracking or use for a materially different purpose needs a separate consent review before activation. If you have enabled GA4 enhanced measurement (scrolls, outbound clicks and similar), those additional events may be collected after consent. Adjust that setting in GA4 if you want to limit collection further. Review your site's privacy notice, data retention and Irish/EU consent requirements before production activation.

## Google Analytics property settings

This website code disables Google signals and ad-personalization signals, and sets advertising consent to denied. Google Analytics may still process default geolocation/device data for ordinary analytics. To reduce granularity, open Google Analytics → Admin → Data collection and modification → Data collection → **Granular location and device data collection** and disable unwanted regions (or all regions). This is a Google property setting, not something the journal's JavaScript can fully control.

Consent for current website analytics must not silently be treated as consent for future advertising personalization or remarketing. Revisit purposes, consent choices, GA4 settings and the privacy notice if those features are introduced.
