// scripts/export-tango-web-assets.test.mjs
//
// WHY THIS EXISTS (audit finding M-12)
//
// export-tango-web-assets.mjs copies TANGO artwork out of the app repo and into
// this one using paths that come STRAIGHT OUT OF A JSON MANIFEST in that other
// repository. Every string in that manifest was concatenated onto appRoot or
// siteRoot with path.join and then handed to fs.copyFileSync, with nothing
// checking where the result actually landed. All three of these were confirmed
// working against the pre-fix script, each exiting 0 as though nothing was
// wrong:
//
//   * READ ANYWHERE — a "../../../../../secret.webp" hero path copied a file
//     from outside the app checkout into assets/tango-levels/rook/level-001.webp;
//   * WRITE ANYWHERE — `level.level` is interpolated into the DESTINATION file
//     name, so a level of "../../../../../evil" dropped evil.webp into the
//     website's root directory, and one more "../" put it outside the checkout
//     altogether;
//   * SYMLINK ESCAPE — a symlink committed inside the allowed source directory
//     is lexically innocent, and its target was copied in regardless.
//
// That matters more here than it would elsewhere: whatever this script writes is
// committed and pushed, and `main` deploys to production with no build step. A
// path escape is therefore a route to publishing someone else's file on a public
// youth-facing website, and to dropping a file into the web root of a site that
// is about to go live.
//
// The tests below are the regression net. They use throwaway temp directories
// only — nothing outside os.tmpdir() is read or written — and they run the real
// exporter as a child process, so they exercise the shipped script rather than a
// copy of its logic.
//
// NOTE ON WHAT "REJECTED" MEANS HERE: a non-zero exit is NOT enough. An early
// draft of this file passed against the vulnerable script because a malformed
// fixture made it die of ENOENT before it got as far as the escape. So every
// rejection case asserts that the exporter REFUSED — a deliberate, named
// containment failure — as well as asserting that nothing escaped.
//
// Run:  node --test scripts/export-tango-web-assets.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const exporter = path.join(here, 'export-tango-web-assets.mjs');

const IMAGE_BYTES = 'RIFF....WEBPVP8 fake-test-image';
const PAYLOAD = 'TOP-SECRET-PAYLOAD';

// The exporter only ever reads assets/tango/**, and only ever singles out level
// 1 (Rook's "plain" homepage image) and level 20 (roster thumbnail + hero), so a
// two-level Rook drives every copy it performs.
const SOURCE_DIR = 'assets/tango/level_states/tango_1';

// Every case gets its own sandbox:
//
//   <sandbox>/app     the pretend Cadet-AI checkout (CADET_APP_ROOT)
//   <sandbox>/site    the pretend website checkout (the exporter's cwd)
//   <sandbox>/…       anything a malicious manifest tries to reach or create
//
// so "did it escape?" is just "did anything appear outside <sandbox>/site?".
function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tango-export-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const appRoot = path.join(dir, 'app');
  const siteRoot = path.join(dir, 'site');
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(siteRoot, { recursive: true });
  return { dir, appRoot, siteRoot };
}

const writeFile = (file, contents) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

const sourcePaths = (n) => {
  const dir = `${SOURCE_DIR}/level_${String(n).padStart(3, '0')}`;
  return {
    showcase: { hero: `${dir}/hero.webp`, thumbnail: `${dir}/thumb.webp` },
    plain: { hero: `${dir}/plain.webp` },
  };
};

const level = (n, overrides = {}) => ({
  level: n,
  slug: n === 1 ? 'recruit' : 'commander',
  ...sourcePaths(n),
  ...overrides,
});

function buildApp(appRoot, levels = [level(1), level(20)]) {
  // Real bytes behind every path a well-formed fixture declares.
  for (const n of [1, 20]) {
    for (const name of ['hero', 'thumb', 'plain']) {
      writeFile(path.join(appRoot, SOURCE_DIR, `level_${String(n).padStart(3, '0')}`, `${name}.webp`), IMAGE_BYTES);
    }
  }
  writeFile(
    path.join(appRoot, 'assets', 'tango', 'level_states', 'manifest.json'),
    JSON.stringify({
      classification: 'OFFICIAL',
      production_ready: true,
      characters: [{ character_id: 'tango_1', character_name: 'Rook', levels }],
    }),
  );
}

const runExport = (appRoot, siteRoot) =>
  spawnSync(process.execPath, [exporter], {
    cwd: siteRoot,
    env: { ...process.env, CADET_APP_ROOT: appRoot },
    encoding: 'utf8',
  });

function filesUnder(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, base, out);
    else out.push(path.relative(base, full).replaceAll(path.sep, '/'));
  }
  return out;
}

const filesCarryingPayload = (siteRoot) =>
  filesUnder(siteRoot).filter((file) => {
    try {
      return fs.readFileSync(path.join(siteRoot, file), 'utf8').includes(PAYLOAD);
    } catch {
      return false;
    }
  });

// A crash is not a control. Insist the exporter refused on purpose.
function assertRefused(result, what) {
  assert.notEqual(result.status, 0, `exporter should have refused ${what}, but exited 0`);
  assert.match(
    result.stderr,
    /refus(?:e|ed|es|ing)/i,
    `exporter exited ${result.status} on ${what}, but not with a containment refusal — ` +
      `an incidental crash is not a control:\n${result.stderr}`,
  );
}

// ── The exporter must keep working ─────────────────────────────────────────

test('copies a normal .webp from the allowlisted source directory', (t) => {
  const { appRoot, siteRoot } = sandbox(t);
  buildApp(appRoot);

  const result = runExport(appRoot, siteRoot);

  assert.equal(result.status, 0, `exporter failed on a legitimate manifest:\n${result.stderr}`);
  for (const expected of [
    'assets/tango-roster/tango-rook-level-20-thumb.webp',
    'assets/tango-roster/tango-rook-level-1-plain.webp',
    'assets/tango-roster/tango-rook-level-20.webp',
    'assets/tango-roster/tango-showcase.json',
    'assets/tango-levels/rook/level-001.webp',
    'assets/tango-levels/rook/level-020.webp',
  ]) {
    assert.ok(fs.existsSync(path.join(siteRoot, expected)), `${expected} should have been exported`);
  }
  const showcase = JSON.parse(fs.readFileSync(path.join(siteRoot, 'assets/tango-roster/tango-showcase.json'), 'utf8'));
  assert.equal(showcase.characters[0].slug, 'rook');
  assert.equal(showcase.characters[0].levels.length, 2);
  assert.equal(showcase.characters[0].levels[0].image, 'assets/tango-levels/rook/level-001.webp');
});

// ── …and must refuse everything that leaves its two sandboxes ──────────────

test('refuses a ../ traversal in a manifest source path', (t) => {
  const { dir, appRoot, siteRoot } = sandbox(t);
  writeFile(path.join(dir, 'secret.webp'), PAYLOAD);
  // Five levels up from assets/tango/level_states/tango_1 lands beside the
  // app checkout. Pre-fix this was copied in as level-001.webp, exit 0.
  buildApp(appRoot, [
    level(1, { showcase: { hero: `${SOURCE_DIR}/../../../../../secret.webp`, thumbnail: `${SOURCE_DIR}/level_001/thumb.webp` } }),
    level(20),
  ]);

  const result = runExport(appRoot, siteRoot);

  assertRefused(result, 'a source path outside the app assets directory');
  assert.deepEqual(
    filesCarryingPayload(siteRoot),
    [],
    'a file from outside the allowlisted source directory was copied into the site',
  );
});

test('refuses a level value that walks the destination out of the site', (t) => {
  const { dir, appRoot, siteRoot } = sandbox(t);
  // level-${level}.webp is the DESTINATION file name, so a level made of "../"
  // is a write-anywhere primitive. Sources stay valid on purpose: the only
  // reason to stop here is the destination.
  buildApp(appRoot, [
    level(1),
    level(20),
    { level: '../../../../../../evil', slug: 'evil', ...sourcePaths(1) },
  ]);

  const result = runExport(appRoot, siteRoot);

  assertRefused(result, 'a level value that escapes the output directory');
  assert.deepEqual(
    filesUnder(dir).filter((file) => !file.startsWith('site/') && !file.startsWith('app/')),
    [],
    'the export wrote outside both the app checkout and the site checkout',
  );
});

test('refuses a level value that writes into the website root', (t) => {
  const { appRoot, siteRoot } = sandbox(t);
  // One "../" fewer than above: this lands in the site root itself, next to
  // index.html — i.e. straight into what GitHub Pages publishes.
  buildApp(appRoot, [
    level(1),
    level(20),
    { level: '../../../../../evil', slug: 'evil', ...sourcePaths(1) },
  ]);

  const result = runExport(appRoot, siteRoot);

  assertRefused(result, 'a level value that writes into the website root');
  assert.deepEqual(
    filesUnder(siteRoot).filter((file) => !file.includes('/')),
    [],
    'the export dropped a file into the published website root',
  );
});

test('refuses a symlink whose real path leaves the allowlisted source directory', (t) => {
  const { dir, appRoot, siteRoot } = sandbox(t);
  writeFile(path.join(dir, 'outside', 'secret.webp'), PAYLOAD);
  buildApp(appRoot);

  // Lexically this is squarely inside assets/tango — only realpath gives it away.
  const planted = path.join(appRoot, SOURCE_DIR, 'level_020', 'hero.webp');
  fs.rmSync(planted);
  try {
    fs.symlinkSync(path.join(dir, 'outside', 'secret.webp'), planted, 'file');
  } catch (error) {
    // Windows needs Developer Mode or elevation to create symlinks. Skipping is
    // honest; silently passing would not be.
    t.skip(`cannot create a symlink on this host (${error.code}) — symlink escape not exercised`);
    return;
  }

  const result = runExport(appRoot, siteRoot);

  assertRefused(result, 'a symlink pointing outside the app assets directory');
  assert.deepEqual(
    filesCarryingPayload(siteRoot),
    [],
    'a symlinked file from outside the allowlisted source directory was copied into the site',
  );
});
