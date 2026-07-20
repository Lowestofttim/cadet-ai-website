# Launch-day website checklist

The app was unpublished from public Google Play on 2026-07-20 pending final
pre-launch checks, and the site was switched to "launching soon" copy in the
same commit that adds this file. When the app goes live in production, sweep
these back the same day:

Store listing URL: `https://play.google.com/store/apps/details?id=com.cadetai.app`

1. **app.html** — restore the direct store handoff:
   - Re-add the auto-redirect inside `<head>`:
     `<meta http-equiv="refresh" content="2;url=https://play.google.com/store/apps/details?id=com.cadetai.app">`
   - Body copy back to: `If the app doesn't open, it isn't installed yet &mdash; grab it free on Google Play.`
   - CTA back to: `<a class="btn" href="https://play.google.com/store/apps/details?id=com.cadetai.app">Get Cadet AI on Google Play</a>`
2. **index.html** — hero + CTA-band buttons (2× `aria-disabled` "Launching soon
   on Google Play" pills) become real store-link buttons ("Get it on Google
   Play"); CTA-band sentence "launching on Google Play very soon" →
   "available now on Google Play".
3. **features.html** — CTA band heading "Launching soon on Google Play." →
   live copy (e.g. "Cadet AI is on Google Play."); `▶` pill → real store link.
4. **faq.html** — the launch answer appears TWICE (visible `<details>` answer
   AND the FAQPage JSON-LD near the top) — update BOTH in lockstep to
   "available now on Google Play".
5. **guides/*.html (8 pages)** — CTA sentence "Launching soon on Google Play."
   / "launching soon on Google Play." → live copy.
6. **Nav button on 7 pages** (features, plans, faq, contact, privacy, terms,
   delete-account) — "Launch updates" → "Get the app" linking to the store.
7. **llms.txt** — both "Launching imminently on Google Play." lines →
   "Available on Google Play." + add the store URL as a link.
8. **sitemap.xml** — bump `<lastmod>` on every touched page.
9. Run `node scripts/validate-homepage.mjs` (and any other scripts/validators)
   before pushing.

og:image:alt text was made status-neutral on 2026-07-20 and needs NO
launch-day edit.

Play Console reminders (not this repo): flip App availability back to
**Published** (Advanced settings) — promoting the release alone does not
relist the app; then verify cadetai.co.uk/app redirects correctly again.
