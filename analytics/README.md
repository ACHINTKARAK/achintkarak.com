# Google Analytics 4 — optional, consent-first implementation

**GA4 Measurement ID:** `G-KYQZZZVGXB` (MyJournal web stream, achintkarak.com).

This feature is isolated from the journal's existing `site.js`, styling and page navigation. The only template modification is a deferred script tag. No generated HTML was changed in this branch.

## Behaviour

- On the first visit in a browser without a valid stored decision, visitors see an unobtrusive notice offering **Accept analytics** and **Reject optional**. There is no Manage choices action.
- After either decision, the notice closes and does **not** appear on subsequent pages in that browser for 180 days. New sessions and page reloads do not renew the 180-day deadline.
- The journal has **no permanent privacy control in its footer**. The clean About page only contains a discreet link to `/privacy/`, where visitors may withdraw or change consent at any time.
- `privacy/index.html` is a static standalone page and is not modified or removed by `tools/build.py`.
- Google Analytics is **never downloaded or initialized until someone explicitly accepts analytics**. Local `localhost` preview never sends GA4 data.
- Browser-local choice is versioned and expires after 180 days. Clearing browser storage or a future material purpose/recipient change may trigger the notice earlier.
- Withdrawal prevents further measurement and attempts to remove this site's GA4 cookies. A running Google tag triggers a reload to stop the script.
- Google currently receives only opted-in page views and custom `album_open` internal link events (plus standard GA4 technical data). Advertising consent remains denied and Google advertising signals disabled.
- Future advertising-related tracking will require a newly disclosed purpose and separate affirmative consent.

## Deployment and testing

1. Review the draft PR before merging. **The live website stays untouched while this branch is unmerged.**
2. Pull this branch locally and run `./journal.ps1 check` (PowerShell) to validate the usual build, then `./journal.ps1 preview` to check layout and navigation.
3. On local preview, the consent control should display for a browser without a stored preference; GA4 does not actually load on localhost to avoid contaminating statistics. To simulate a first-time visitor after testing, use a fresh private window or clear the `ak_privacy_choices_v2` localStorage key.
4. After merging and rebuilding/deploying with your usual publishing process, visit `https://achintkarak.com` in a fresh browser session. Accept or reject, then check that the notice disappears and remains absent on subsequent pages; after 180 days it is shown again (or sooner if the saved choice is removed or policy version changes).
5. Before acceptance, check Network: **no requests to `googletagmanager.com` or `google-analytics.com`** from this integration.
6. Accept analytics; verify a Google tag request appears. Then check Google Analytics → Reports → Realtime (reporting can take some time).
7. Open an album and verify its page path appears. If you want custom click reporting, register `album_path` as an event-scoped custom dimension in GA4.
8. Test Reject optional, then navigate to About → Privacy → Change analytics choice or Reject analytics; check that no link appears next to the copyright on the homepage. Test on mobile and with blocked third-party scripts.

## Reverting

Revert the template additions and remove `analytics/ga4-consent.js`, then run the normal build. The journal's core JavaScript remains unchanged.

## Privacy notes

Google receives analytics data for visitors who opt in. The first-visit notice describes album/page analytics, and the standalone **Privacy** page explains Google's standard technical processing and links to Google's privacy policy. The About page contains only a discreet link; no privacy paragraph or widget appears alongside the photographic statement. Advertising-related tracking is currently disabled; enabling any actual advertising uses requires an updated notice, a separate optional category with real vendor/purpose details, and fresh, specific permission. If you have enabled GA4 enhanced measurement (scrolls, outbound clicks and similar), those additional events may be collected after consent. Adjust that setting in GA4 if you want to limit collection further. Review your site's privacy notice, data retention and Irish/EU consent requirements before production activation.

## Google Analytics property settings

This website code disables Google signals and ad-personalization signals, and sets advertising consent to denied. Google Analytics may still process default geolocation/device data for ordinary analytics. To reduce granularity, open Google Analytics → Admin → Data collection and modification → Data collection → **Granular location and device data collection** and disable unwanted regions (or all regions). This is a Google property setting, not something the journal's JavaScript can fully control.

Consent for current website analytics must not silently be treated as consent for future advertising personalization or remarketing. Revisit purposes, consent choices, GA4 settings and the privacy notice if those features are introduced.
