// scripts/no-third-party-runtime.test.mjs
//
// WHY THIS EXISTS (audit finding M-11)
//
// cadetai.co.uk is a public, youth-facing site: its visitors are UK cadets aged
// 13+. Every third-party host the markup makes the BROWSER fetch at page load —
// a widget script, a webfont stylesheet, a font file — receives that child's IP
// address, User-Agent and Referer before they have clicked anything and without
// any consent step. That is a disclosure of a child's personal data to a third
// party, not a styling detail, and there is no consent banner here to authorise
// it (nor should there need to be: the fix is not to ask, it is not to leak).
//
// So the rule this file enforces is simply: the site loads nothing at runtime
// that is not committed in this repository. Outbound LINKS are fine — a link is
// a deliberate act by the reader. A <script src>, a <link rel="stylesheet">, a
// preconnect or a font fetch is not.
//
// Deliberately dependency-free (node builtins only, no package.json, no
// network), like the other checks in this directory.
//
// Run:  node --test scripts/no-third-party-runtime.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Runtime origins this site must never make a visitor's browser talk to.
// Matched as plain substrings, case-insensitively, anywhere in the file: a
// preconnect, a stylesheet href, a script src and a CSP allowance all count.
const BANNED_RUNTIME_SOURCES = [
  'tiktok.com/embed.js',
];

const THIRD_PARTY_RUNTIME_HOSTS = [
  'tiktok.com',
  'ttwstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'googletagmanager.com',
  'google-analytics.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

function walk(dir, extensions, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, out);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) out.push(full);
  }
  return out;
}

const relative = (file) => path.relative(root, file).replaceAll(path.sep, '/');

const htmlFiles = walk(root, ['.html']).sort();
const assetFiles = walk(root, ['.css', '.js']).sort();

test('every .html file is committed with no third-party runtime source', () => {
  assert.ok(htmlFiles.length > 0, 'expected to find .html files to check');
  const offenders = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8').toLowerCase();
    for (const banned of BANNED_RUNTIME_SOURCES) {
      if (html.includes(banned)) offenders.push(`${relative(file)}: loads ${banned}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A visitor of this site is a child. These references disclose their IP, ' +
      'User-Agent and Referer to a third party on page load, with no consent ' +
      `step:\n  - ${offenders.join('\n  - ')}\n`,
  );
});

test('stylesheets and scripts pull nothing from a third-party host either', () => {
  const offenders = [];
  for (const file of assetFiles) {
    const source = fs.readFileSync(file, 'utf8').toLowerCase();
    for (const banned of BANNED_RUNTIME_SOURCES) {
      if (source.includes(banned)) offenders.push(`${relative(file)}: references ${banned}`);
    }
  }
  assert.deepEqual(offenders, [], `Third-party runtime source in a committed asset:\n  - ${offenders.join('\n  - ')}\n`);
});

// A CSP that still NAMES a third-party host is a standing invitation: it means
// re-adding the embed would not trip any other check here. The policy must not
// permit what the markup no longer does.
test('no in-page Content-Security-Policy permits a remote origin', () => {
  const offenders = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    // NB: the content="…" value is full of single quotes ('self', 'none',
    // 'sha256-…'), so the attribute delimiter has to be captured and matched
    // back — a naive ["'] on both ends stops at the first 'self' and silently
    // checks nothing.
    for (const meta of html.matchAll(
      /<meta\b[^>]*http-equiv\s*=\s*(["'])Content-Security-Policy\1[^>]*\bcontent\s*=\s*(["'])([^>]*?)\2/gi,
    )) {
      for (const directive of meta[3].split(';')) {
        const [name, ...sources] = directive.trim().split(/\s+/).filter(Boolean);
        if (!name) continue;
        for (const source of sources) {
          // 'self' / 'none' / 'unsafe-inline' / 'sha256-…' are quoted keywords;
          // data: / blob: are scheme sources. Anything else names a host, and
          // on a site whose every asset is committed there is no reason for one.
          if (source.startsWith("'") || source.endsWith(':')) continue;
          offenders.push(`${relative(file)}: ${name} allows ${source}`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `In-page CSP still permits a remote origin (every asset here is committed, ` +
      `so 'self' is enough):\n  - ${offenders.join('\n  - ')}\n`,
  );
});

// ---------------------------------------------------------------------------
// _headers was invisible to this test.
//
// It walked .html/.css/.js only, so the site-wide CSP was never read -- and that
// CSP went on PERMITTING the very hosts M-11 removed (frame-src and script-src
// www.tiktok.com + *.ttwstatic.com, style-src fonts.googleapis.com, font-src
// fonts.gstatic.com) long after the embed and the web-font links were gone.
// Inert only because GitHub Pages ignores the file (L-07); the moment L-07 is
// remediated with a CDN, an unenforced-but-permissive policy becomes an
// enforced-and-permissive one, on a site aimed at children.
//
// A per-page <meta> CSP has the same exposure, so both are checked.
// ---------------------------------------------------------------------------
test('no CSP permits a third-party runtime origin', () => {
  const policyFiles = [];
  const headers = path.join(root, '_headers');
  if (fs.existsSync(headers)) policyFiles.push(headers);
  policyFiles.push(...htmlFiles);

  assert.ok(policyFiles.length > 0, 'expected at least one file carrying a CSP');

  for (const file of policyFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    // Only the directives themselves -- the explanatory comments in _headers
    // name these hosts deliberately, to record why they were removed.
    const policies = [
      // Capture to end of line. An earlier version used [^\r\n"']+ to avoid
      // colliding with the meta-tag form -- but a CSP is full of single quotes
      // ('none', 'self'), so the match stopped dead at `default-src ` and never
      // reached the host list. The guard passed while permitting every origin it
      // was written to ban, and only the mutation test showed it.
      ...raw.matchAll(/Content-Security-Policy:[ \t]*([^\r\n]+)/gi),
      ...raw.matchAll(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/gi),
    ].map((m) => m[1]);

    for (const policy of policies) {
      for (const host of THIRD_PARTY_RUNTIME_HOSTS) {
        assert.ok(
          !policy.includes(host),
          `${path.relative(root, file)} has a CSP permitting ${host}. ` +
            'M-11 removed these origins from the pages; permitting them here ' +
            'lets them come straight back the moment a header-honouring host ' +
            'is put in front of the site.',
        );
      }
    }
  }
});
