# Cadet AI — website

Marketing site for the **Cadet AI** app (a study aid for UK ACF & CCF cadets,
13+). Static HTML/CSS, hosted on GitHub Pages.

- **Live:** https://cadetai.co.uk/ (custom domain) — also at the GitHub Pages URL.
- Pages: `index.html` (home), `features.html`, `faq.html`, `contact.html`.
- `styles.css` — shared design system (olive/gold military theme, Oswald headings).
- `site.js` — small progressive-enhancement count-up for stats.
- Brand art in `assets/` (TANGO mascot + app icon).

No build step. Edit the HTML/CSS and push to `main`; GitHub Pages redeploys.

## Security headers

GitHub Pages cannot set custom response headers, so the only security controls
a browser will actually honour here are the two that work as `<meta>` tags.

**Enforced today** (every `.html` carries both, in `<head>`):

- **Content-Security-Policy** — `<meta http-equiv="Content-Security-Policy">`.
  Baseline is `default-src 'none'` with every fetch directive named
  explicitly: scripts and images and media and XHR are same-origin only,
  `object-src`/`worker-src`/`frame-src`/`base-uri`/`form-action` are `'none'`,
  fonts come only from `fonts.gstatic.com`, stylesheets only from `'self'` +
  `fonts.googleapis.com`. No `'unsafe-inline'` or `'unsafe-eval'` in
  `script-src` on any page; the one inline script (the `js` class flag) is
  allowed by sha256 hash. `'unsafe-inline'` survives in `style-src` only
  because the markup uses inline `style="…"` attributes — modern browsers
  confine that to `style-src-attr`, while `style-src-elem` stays locked, so an
  injected `<style>` block is still blocked. `index.html` additionally allows
  the TikTok creator embed (`www.tiktok.com`, `*.ttwstatic.com`).
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
