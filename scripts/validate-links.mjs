// scripts/validate-links.mjs
//
// Structural + link sanity check for the static site.
//
// WHY THIS EXISTS: `main` deploys straight to GitHub Pages. There is no build
// step, so nothing resolves a relative href or notices a renamed asset — a typo
// in a link is live the moment it is pushed. This is the cheap, offline half of
// the pre-deploy gate: every internal link and asset reference must resolve to a
// file that is actually committed, and every in-page anchor must have a target.
//
// Deliberately dependency-free (node builtins only, no package.json, no network)
// so the PR workflow needs no install step, no secrets and no lockfile, and so it
// cannot go red because a third party is having a bad day.
//
// Run:  node scripts/validate-links.mjs

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Google/Bing/TikTok ownership stubs are single-line text files that happen to
// end in .html. They are not pages and must not be linted as pages.
const VERIFICATION_STUBS = /^(google[0-9a-f]+\.html|BingSiteAuth\.xml)$/;

// Anything the site links to that is not a file in this repo.
const isExternal = (href) =>
  /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || href.startsWith('data:');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html') && !VERIFICATION_STUBS.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const pages = walk(root).sort();
const errors = [];
const fail = (file, message) => errors.push(`${path.relative(root, file).replaceAll(path.sep, '/')}: ${message}`);

// id="..." and name="..." both make a valid fragment target.
function anchorsIn(html) {
  const ids = new Set();
  for (const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(match[1]);
  for (const match of html.matchAll(/<a\b[^>]*\bname\s*=\s*["']([^"']+)["']/g)) ids.add(match[1]);
  return ids;
}

const pageHtml = new Map();
const pageAnchors = new Map();
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  pageHtml.set(page, html);
  pageAnchors.set(page, anchorsIn(html));
}

let checkedRefs = 0;

for (const page of pages) {
  const html = pageHtml.get(page);
  const dir = path.dirname(page);

  // ── Structure ────────────────────────────────────────────────────────────
  // These are the things a browser will not tell you about and a reviewer will
  // not notice, but that break SEO, sharing or a screen reader outright.
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) {
    fail(page, '<html> needs a lang attribute (screen readers and translation rely on it)');
  }
  const titles = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/gi) ?? [];
  if (titles.length !== 1) {
    fail(page, `expected exactly one <title>, found ${titles.length}`);
  } else if (!titles[0].replace(/<\/?title[^>]*>/gi, '').trim()) {
    fail(page, '<title> is empty');
  }
  const h1s = html.match(/<h1\b/gi) ?? [];
  if (h1s.length !== 1) {
    fail(page, `expected exactly one <h1>, found ${h1s.length}`);
  }
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) {
    fail(page, 'missing <meta name="viewport"> (the site is mobile-first)');
  }
  // Only pages that are meant to be indexed need one. app.html is a noindex
  // App-Link handoff stub that redirects to Play; a description there is noise.
  const noindex = /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*\bcontent\s*=\s*["'][^"']*noindex/i.test(html);
  if (!noindex && !/<meta\b[^>]*\bname\s*=\s*["']description["']/i.test(html)) {
    fail(page, 'missing <meta name="description"> (search + link previews)');
  }
  // Every .html carries the CSP and referrer <meta> tags; GitHub Pages cannot
  // send them as headers, so losing one silently drops the only enforcement
  // the browser will honour. See the Security headers section of README.md.
  if (!/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html)) {
    fail(page, 'missing the in-page Content-Security-Policy <meta> (README: Security headers)');
  }
  if (!/<meta\b[^>]*\bname\s*=\s*["']referrer["']/i.test(html)) {
    fail(page, 'missing the <meta name="referrer"> policy (README: Security headers)');
  }
  // Mojibake has bitten this site before; validate-homepage.mjs pins it for
  // index.html, site.js and styles.css, this covers every page.
  //
  // A LEADING byte-order mark is tolerated: 16 of the 18 committed pages carry
  // one (index.html is the odd one out), browsers strip it, and reformatting
  // every page to remove it is a separate change from adding this gate. What is
  // NOT tolerated is a U+FEFF anywhere else, which means a file was concatenated
  // or re-encoded badly rather than merely saved with a BOM.
  const bodyAfterBom = html.startsWith('﻿') ? html.slice(1) : html;
  if (/�/.test(bodyAfterBom)) {
    fail(page, 'contains a U+FFFD replacement character (encoding damage)');
  }
  if (/﻿/.test(bodyAfterBom)) {
    fail(page, 'contains a byte-order mark away from the start of the file (encoding damage)');
  }
  if (/â|Ã/.test(bodyAfterBom)) {
    fail(page, 'contains UTF-8-read-as-Latin-1 mojibake (e.g. â for an apostrophe)');
  }

  // Every image needs alt text — empty alt="" is fine (decorative), missing is not.
  for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=/i.test(img[0])) {
      fail(page, `<img> without an alt attribute: ${img[0].slice(0, 110)}`);
    }
  }

  // A link that opens a new tab and can reach an attacker-controlled origin
  // must not hand it window.opener.
  for (const anchor of html.matchAll(/<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi)) {
    if (!/\brel\s*=\s*["'][^"']*noopener/i.test(anchor[0])) {
      fail(page, `target="_blank" without rel="noopener": ${anchor[0].slice(0, 110)}`);
    }
  }

  // ── Links and asset references ───────────────────────────────────────────
  const refs = [
    ...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi),
  ].map((match) => match[1].trim());

  for (const raw of refs) {
    if (!raw || isExternal(raw)) continue;
    checkedRefs += 1;

    const [pathPart, fragment] = raw.split('#');

    // Same-page anchor.
    if (!pathPart) {
      if (fragment && !pageAnchors.get(page).has(fragment)) {
        fail(page, `anchor #${fragment} has no matching id on this page`);
      }
      continue;
    }

    // Strip the cache-busting query the site uses on styles.css / site.js / audio.
    const cleaned = pathPart.split('?')[0];
    const target = cleaned.startsWith('/')
      ? path.join(root, cleaned)
      : path.resolve(dir, cleaned);

    // Never let a reference escape the repo — that would 404 on Pages.
    if (!target.startsWith(root)) {
      fail(page, `reference escapes the site root: ${raw}`);
      continue;
    }
    if (!fs.existsSync(target)) {
      fail(page, `broken reference (no such file): ${raw}`);
      continue;
    }
    // Cross-page fragment: the target page must actually have that id.
    if (fragment && target.endsWith('.html') && pageAnchors.has(target)) {
      if (!pageAnchors.get(target).has(fragment)) {
        fail(page, `anchor #${fragment} does not exist in ${cleaned}`);
      }
    }
  }

  // Canonical URLs must point at the live domain, or search engines index the
  // wrong host after a Pages-URL copy/paste.
  const canonical = html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*\bhref\s*=\s*["']([^"']+)["']/i);
  if (canonical && !canonical[1].startsWith('https://cadetai.co.uk')) {
    fail(page, `canonical URL should be on https://cadetai.co.uk: ${canonical[1]}`);
  }
}

// ── Sitemap must not advertise pages that no longer exist ──────────────────
const sitemapPath = path.join(root, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  for (const loc of sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = loc[1];
    if (!url.startsWith('https://cadetai.co.uk')) {
      errors.push(`sitemap.xml: <loc> should be on https://cadetai.co.uk: ${url}`);
      continue;
    }
    let route = url.replace('https://cadetai.co.uk', '') || '/';
    if (route.endsWith('/')) route += 'index.html';
    const target = path.join(root, route);
    if (!fs.existsSync(target)) {
      errors.push(`sitemap.xml: <loc> ${url} has no committed page (${route})`);
    }
  }
}

if (errors.length) {
  console.error(`Link/structure validation FAILED — ${errors.length} problem(s):\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error(
    '\nmain deploys straight to GitHub Pages, so these would go live on merge.',
  );
  process.exit(1);
}

console.log(
  `Link/structure validation passed: ${pages.length} pages, ${checkedRefs} internal references checked`,
);
