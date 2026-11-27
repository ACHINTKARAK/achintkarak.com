# Google Analytics 4 — optional, consent-first implementation

**GA4 Measurement ID:** `G-KYQZZZVGXB` (MyJournal web stream, achintkarak.com).

This feature is isolated from the journal's existing `site.js`, styling and page navigation. The only template modification is a deferred script tag. No generated HTML was changed in this branch.

## Behaviour

- Google Analytics is **not downloaded or initialized until someone selects “Accept analytics.”**
- On first visit, a small consent control appears with Accept and Decline as equal choices.
- The choice is stored in this browser (localStorage); it is not itself transmitted to Google.
- Visitors who decline can browse and view photographs as normal.
- “Analytics preferences” remains available in each page footer to change the decision.
- When a user revokes acceptance, the script disables collection, attempts to remove `_ga` cookies, and reloads the document to unload the tag. Already-collected data is not deleted.
- The script records GA4 page views and a custom `album_open` event when an internal album link is selected. `album_path` and `source_path` are site paths, not personal data.
- The script deliberately excludes query strings, disables advertising personalization/signals and does not send tracking data in local previews.
- GA4 may still collect its standard analytics parameters from consenting visitors, subject to your GA4 settings.

## Deployment and testing

1. Review the draft PR before merging. **The live website stays untouched while this branch is unmerged.**
2. Pull this branch locally and run `./journal.ps1 check` (PowerShell) to validate the usual build, then `./journal.ps1 preview` to check layout and navigation.
3. On local preview, the consent control should display; GA4 does not actually load on localhost to avoid contaminating statistics.
4. After merging and rebuilding/deploying with your usual publishing process, visit `https://achintkarak.com` in a fresh browser session.
5. Before acceptance, check Network: **no requests to `googletagmanager.com` or `google-analytics.com`** from this integration.
6. Accept analytics; verify a Google tag request appears. Then check Google Analytics → Reports → Realtime (reporting can take some time).
7. Open an album and verify its page path appears. If you want custom click reporting, register `album_path` as an event-scoped custom dimension in GA4.
8. Test Decline and re-open the preferences button. Test on mobile and with blocked third-party scripts.

## Reverting

Revert the template additions and remove `analytics/ga4-consent.js`, then run the normal build. The journal's core JavaScript remains unchanged.

## Privacy notes

Google receives analytics data for visitors who opt in. If you have enabled GA4 enhanced measurement (scrolls, outbound clicks and similar), those additional events may be collected after consent. Adjust that setting in GA4 if you want to limit collection further. Review your site's privacy notice, data retention and Irish/EU consent requirements before production activation.
