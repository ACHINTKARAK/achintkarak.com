# Google Analytics 4 — optional, consent-first implementation

**GA4 Measurement ID:** `G-KYQZZZVGXB` (MyJournal web stream, achintkarak.com).

This feature is isolated from the journal's existing `site.js`, styling and page navigation. The only template modification is a deferred script tag. No generated HTML was changed in this branch.

## Behaviour

- On the first visit in a browser with no valid saved choice, visitors see an understated privacy notice.
- The notice offers **Accept analytics**, **Reject optional** and **Manage choices** with equally accessible controls.
- **Manage choices** lists Essential (always on), Audience analytics (off by default), and Advertising & personalisation (not currently used and disabled). Clicking **Save my choices** respects the optional analytics checkbox.
- Google Analytics is **not downloaded or initialized until someone explicitly selects analytics**.
- A saved choice is versioned and expires after 180 days; a material change to the actual purposes/recipients must trigger a new informed choice, regardless of earlier consent.
- Preference storage is browser-local. Visitors who reject can browse the entire journal unchanged.
- After a decision, the consent notice disappears and no permanent consent button is shown. A discreet **Privacy** text link stays in the footer so visitors can easily reopen their choices and withdraw consent. Revoking removes analytics cookies on a best-effort basis, disables future measurement and reloads if Google scripts were previously loaded.
- Google currently receives only opted-in page views and custom `album_open` internal link events (plus normal GA4 technical data). No advertising tags or personalization are enabled.
- **A future advertising implementation requires separately disclosed, freely given permission.** An inactive disabled category in today's interface is NOT future permission for any unknown advertising vendor or purpose.

## Deployment and testing

1. Review the draft PR before merging. **The live website stays untouched while this branch is unmerged.**
2. Pull this branch locally and run `./journal.ps1 check` (PowerShell) to validate the usual build, then `./journal.ps1 preview` to check layout and navigation.
3. On local preview, the consent control should display for a browser without a stored preference; GA4 does not actually load on localhost to avoid contaminating statistics. To simulate a first-time visitor after testing, use a fresh private window or clear the `ak_privacy_choices_v2` localStorage key.
4. After merging and rebuilding/deploying with your usual publishing process, visit `https://achintkarak.com` in a fresh browser session. Accept or reject, then check that the notice disappears and remains absent on subsequent pages; after 180 days it is shown again (or sooner if the saved choice is removed or policy version changes).
5. Before acceptance, check Network: **no requests to `googletagmanager.com` or `google-analytics.com`** from this integration.
6. Accept analytics; verify a Google tag request appears. Then check Google Analytics → Reports → Realtime (reporting can take some time).
7. Open an album and verify its page path appears. If you want custom click reporting, register `album_path` as an event-scoped custom dimension in GA4.
8. Test Reject optional, then re-open via the discreet Privacy footer link. Test on mobile and with blocked third-party scripts.

## Reverting

Revert the template additions and remove `analytics/ga4-consent.js`, then run the normal build. The journal's core JavaScript remains unchanged.

## Privacy notes

Google receives analytics data for visitors who opt in. The first-visit notice describes album/page analytics, and the **Manage choices** panel explains Google's standard technical processing and links to Google's own privacy policy. The About page stays dedicated to the photographic journal. Advertising-related tracking is currently disabled; enabling any actual advertising uses requires an updated notice, a separate optional category with real vendor/purpose details, and fresh, specific permission. If you have enabled GA4 enhanced measurement (scrolls, outbound clicks and similar), those additional events may be collected after consent. Adjust that setting in GA4 if you want to limit collection further. Review your site's privacy notice, data retention and Irish/EU consent requirements before production activation.

## Google Analytics property settings

This website code disables Google signals and ad-personalization signals, and sets advertising consent to denied. Google Analytics may still process default geolocation/device data for ordinary analytics. To reduce granularity, open Google Analytics → Admin → Data collection and modification → Data collection → **Granular location and device data collection** and disable unwanted regions (or all regions). This is a Google property setting, not something the journal's JavaScript can fully control.

Consent for current website analytics must not silently be treated as consent for future advertising personalization or remarketing. Revisit purposes, consent choices, GA4 settings and the privacy notice if those features are introduced.
