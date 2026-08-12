# Cadet AI — website

Marketing site for the **Cadet AI** app (a study aid for UK ACF & CCF cadets,
13+). Static HTML/CSS, hosted on GitHub Pages.

- **Live:** https://cadetai.co.uk/ (custom domain) — also at the GitHub Pages URL.
- Pages: `index.html` (home), `features.html`, `faq.html`, `contact.html`.
- `styles.css` — shared design system (olive/gold military theme, Oswald headings).
- `site.js` — small progressive-enhancement count-up for stats.
- Brand art in `assets/` (TANGO mascot + app icon).

No build step. Edit the HTML/CSS and push to `main`; GitHub Pages redeploys.

## ⚠️ `main` is production — the PR checks are the only gate

**Pushing to `main` deploys straight to https://cadetai.co.uk.** There is no build
step, no staging environment, no review app and no smoke test after deploy. The
only rollback is another push.

So the pull-request workflow is the *only* thing that runs before production.
Work on a branch, open a PR, let the checks go green, then merge.

`.github/workflows/pr-validate.yml` runs on every PR to `main` (and again on push
to `main`, which catches a direct push that skipped the PR but cannot stop the
deploy it triggered):

| Check | What it catches |
|---|---|
| `node scripts/validate-links.mjs` | broken internal links and asset references, dead `#anchors`, missing/duplicate `<title>` or `<h1>`, missing `lang` / viewport / description, a dropped in-page CSP or referrer `<meta>`, `<img>` without `alt`, `target="_blank"` without `rel="noopener"`, wrong canonical host, encoding damage, and a `sitemap.xml` advertising a page that no longer exists |
| `node scripts/validate-homepage.mjs` | missing TANGO artwork and showcase JSON, stale cache-busting versions, changed social links, the Latest TikTok section's link-only form, plans/FAQ voice-tier wording, the Digital Asset Links fingerprints, and the 13+ terms wording |
| `node --test scripts/no-third-party-runtime.test.mjs` | any third-party host the browser would contact on page load — a widget script, a webfont stylesheet or font file, a preconnect — plus any in-page CSP that still *permits* one |

Both are dependency-free (Node builtins only — no `package.json`, no install
step, no lockfile), need no secrets and make no network calls, so the gate cannot
go red because a third party is down. Run them locally before pushing:

```bash
node scripts/validate-links.mjs
node scripts/validate-homepage.mjs
node --test scripts/no-third-party-runtime.test.mjs
```

**If a check fails, fix the site — not the check.** Do not add
`continue-on-error`, and do not delete a step to get a PR green.

### The cross-repo artwork check runs separately

`scripts/validate-tango-web-assets-from-app.mjs` sha256-compares every TANGO
image here against the app repo's runtime export, so it needs a checkout of
`Lowestofttim/Cadet-AI` too. It is **not** in the PR gate: it compares against
another repository's `main`, so an app-side re-export would redden every open
website PR, including ones that never touched an image — and a required check
that fails for reasons the author cannot fix is one people learn to bypass.

It lives in `.github/workflows/tango-asset-parity.yml` instead (Actions → *TANGO
asset parity* → **Run workflow**, plus a weekly Monday run). Run it on demand
before any release where the artwork matters, and after any app-side re-export.
A red run means "re-run `scripts/export-tango-web-assets.mjs` and open a PR" — a
content task, not a merge blocker. Locally:

```bash
CADET_APP_ROOT=/path/to/Cadet-AI node scripts/validate-tango-web-assets-from-app.mjs
```

## Security headers

GitHub Pages cannot set custom response headers, so the only security controls
a browser will actually honour here are the two that work as `<meta>` tags.

**Enforced today** (every `.html` carries both, in `<head>`):

- **Content-Security-Policy** — `<meta http-equiv="Content-Security-Policy">`.
  Baseline is `default-src 'none'` with every fetch directive named
  explicitly, and **every directive is now same-origin or `'none'` on every
  page** — no host is named anywhere. Scripts, styles, images, media and XHR
  are `'self'`; `object-src`/`worker-src`/`frame-src`/`font-src`/`base-uri`/
  `form-action` are `'none'`. No `'unsafe-inline'` or `'unsafe-eval'` in
  `script-src` on any page; the one inline script (the `js` class flag) is
  allowed by sha256 hash. `'unsafe-inline'` survives in `style-src` only
  because the markup uses inline `style="…"` attributes — modern browsers
  confine that to `style-src-attr`, while `style-src-elem` stays locked, so an
  injected `<style>` block is still blocked.

  This site is read by children aged 13+, so the rule behind that policy is
  **nothing loads at runtime that is not committed here** (audit finding M-11).
  Until 2026-08 the pages fetched Oswald and Inter from Google's webfont CDN and
  the home page ran TikTok's creator-embed widget, which handed each young
  visitor's IP address, User-Agent and Referer to Google and TikTok on page load
  with no consent step. Headings and body text now use system font stacks
  (`--font-display` / `--font-body` in `styles.css`) and the *Latest TikTok*
  section is a committed poster image plus an ordinary outbound link.
  `scripts/no-third-party-runtime.test.mjs` fails the build if any of that comes
  back — including a CSP that merely *permits* a remote host. If a webfont is
  ever genuinely needed, self-host the files under `assets/`.
- **Referrer-Policy** — `<meta name="referrer" content="strict-origin-when-cross-origin">`.

**Not enforceable on GitHub Pages** (header-only; there is no working `<meta>`
form, so none are faked in the markup): `Strict-Transport-Security`,
`X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, and CSP
`frame-ancestors` (browsers explicitly ignore it when delivered via `<meta>`).
The practical gap is that the site has **no clickjacking protection, no HSTS
and no MIME-sniffing protection** today.

**What a proxy would buy:** putting Cloudflare (free) in front of GitHub Pages
— or moving to Cloudflare Pages / Netlify — makes the committed `_headers`
file live, which adds HSTS, framing/clickjacking protection, `nosniff` and
`Permissions-Policy` on top of the CSP already enforced in-page.

`_headers` is kept as the single source of truth for that day; it is inert
until then, and its top-of-file comment says so.

> Cadet AI is an independent study aid. It is not an official MOD, ACF, CCF or
> Cadet Forces product and is not endorsed by them.
