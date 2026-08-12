// Copies the app's exported TANGO artwork into this repo.
//
// ⚠️ EVERY PATH THIS SCRIPT HANDLES IS UNTRUSTED INPUT (audit finding M-12).
//
// The hero/thumbnail/plain paths and the level numbers all come out of
// assets/tango/level_states/manifest.json in the APP repository, and they used
// to be concatenated onto appRoot/siteRoot and handed straight to
// fs.copyFileSync. Nothing checked where the result landed, so a manifest could
// read a file from outside the app checkout, and — because `level.level` is
// interpolated into the destination FILE NAME — write one anywhere the operator
// could write, including this website's root directory. Whatever this script
// produces gets committed and pushed, and `main` deploys to production with no
// build step, so that was a route to publishing someone else's file on a public
// youth-facing site.
//
// So: every source is confined to <appRoot>/assets/tango, every destination is
// confined to the two output directories below, both are checked LEXICALLY and
// again after fs.realpathSync (a symlink is lexically innocent), and only image
// extensions are accepted. scripts/export-tango-web-assets.test.mjs holds this
// down — run it after any change here.
import fs from 'node:fs';
import path from 'node:path';

const siteRoot = process.cwd();
const appRoot = process.env.CADET_APP_ROOT || path.resolve(siteRoot, '..', 'Cadet training docs');
const manifestPath = path.join(appRoot, 'assets', 'tango', 'level_states', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const rosterDir = path.join(siteRoot, 'assets', 'tango-roster');
const levelsDir = path.join(siteRoot, 'assets', 'tango-levels');
fs.mkdirSync(rosterDir, { recursive: true });
fs.mkdirSync(levelsDir, { recursive: true });

// The only directory a manifest may read from, and the only two it may write to.
const sourceRoot = path.join(appRoot, 'assets', 'tango');
const outputRoots = [rosterDir, levelsDir];
const allowedExtensions = new Set(['.webp', '.png', '.jpg', '.jpeg']);

const refuse = (message) => {
  throw new Error(`Refusing to copy — ${message}`);
};

// path.relative is the containment test. Reject '' (the candidate IS the root),
// anything that climbs out with '..', and anything absolute (a different drive
// or UNC share, where "relative to" is meaningless).
const isInside = (root, candidate) => {
  const rel = path.relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

// Lexical containment alone cannot see a symlink, so both ends are re-checked
// against real paths. A destination usually does not exist yet, so resolve the
// deepest parent that does and re-attach the missing tail: that still follows a
// symlinked parent directory, which is the part an attacker controls.
const realpathOrNearest = (target) => {
  let current = path.resolve(target);
  const missing = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...missing.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      missing.push(path.basename(current));
      current = parent;
    }
  }
};

const containedPath = (base, segment, roots, description) => {
  if (typeof segment !== 'string' || segment.trim() === '') {
    refuse(`${description} is not a usable path: ${JSON.stringify(segment)}`);
  }
  // path.join (not path.resolve) on purpose: it keeps the existing behaviour
  // where an absolute, drive-letter or UNC string is glued harmlessly onto the
  // base rather than replacing it. The checks below are what stop escapes.
  const lexical = path.resolve(path.join(base, segment));
  const real = realpathOrNearest(lexical);

  if (!allowedExtensions.has(path.extname(lexical).toLowerCase())) {
    refuse(`${description} is not an image file this exporter handles: ${segment}`);
  }
  const contained = roots.some(
    (root) => isInside(path.resolve(root), lexical) && isInside(realpathOrNearest(root), real),
  );
  if (!contained) {
    refuse(
      `${description} escapes its allowed directory.\n` +
        `  manifest value: ${segment}\n` +
        `  resolves to:    ${lexical}\n` +
        `  real path:      ${real}\n` +
        `  allowed:        ${roots.join(', ')}`,
    );
  }
  return lexical;
};

// `level.level` is interpolated into the destination file name, so it has to be
// an actual level number before it goes anywhere near a path.
const levelNumber = (value) => {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    refuse(`manifest level is not a level number: ${JSON.stringify(value)}`);
  }
  return String(value).padStart(3, '0');
};

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const titleCase = (value) =>
  value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const copyFromApp = (relativeSource, relativeTarget) => {
  const source = containedPath(appRoot, relativeSource, [sourceRoot], 'manifest source path');
  const target = containedPath(siteRoot, relativeTarget, outputRoots, 'export destination');
  // Only after both ends are known-contained — otherwise this would happily
  // create directories outside the site to hold an escaping write.
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

// ── Hand-maintained character copy ───────────────────────────────────────────
//
// `video`, `role` and `bio` are NOT in the app manifest -- verified: the string
// "video", "role" and "bio" do not appear as keys anywhere in
// assets/tango/level_states/manifest.json. They are written and maintained HERE,
// in this repository, and site.js reads all three to drive the homepage TANGO
// viewer modal (video playback plus the role/bio text).
//
// This export used to rebuild tango-showcase.json with only id/name/slug/
// thumbnail/levels, so following the documented workflow -- README says a red
// "TANGO asset parity" run means re-run this script and open a PR -- silently
// stripped all 60 values and degraded the viewer. The images reproduced
// byte-for-byte, which made the loss easy to miss in review.
//
// So carry them forward from the committed file, keyed on character id, and
// refuse to write a lossy export. If you need to CHANGE this copy, edit
// tango-showcase.json directly and re-run: the values round-trip.
const showcasePath = path.join(rosterDir, 'tango-showcase.json');
const carriedCopyFields = ['video', 'role', 'bio'];

const readCarriedCopy = () => {
  if (!fs.existsSync(showcasePath)) {
    refuse(
      `cannot carry forward hand-maintained character copy: ${showcasePath} is missing.\n` +
        `  ${carriedCopyFields.join('/')} live only in this file -- they are not in the app manifest.\n` +
        '  Restore it from git before re-running, or this export would silently drop them.',
    );
  }
  const previous = JSON.parse(fs.readFileSync(showcasePath, 'utf8'));
  const byId = new Map();
  for (const character of previous.characters ?? []) {
    byId.set(character.id, character);
  }
  return byId;
};

const carriedCopy = readCarriedCopy();

// Fail closed rather than emitting a character the homepage viewer cannot render.
const carryCopyForward = (characterId, characterName) => {
  const previous = carriedCopy.get(characterId);
  if (!previous) {
    refuse(
      `no existing entry for ${characterId} (${characterName}) in tango-showcase.json.\n` +
        `  A new character needs its ${carriedCopyFields.join('/')} written by hand first --\n` +
        '  they cannot be derived from the app manifest, and this script must not invent them.',
    );
  }
  const carried = {};
  for (const field of carriedCopyFields) {
    const value = previous[field];
    if (typeof value !== 'string' || value.trim() === '') {
      refuse(
        `${characterId} (${characterName}) has no usable "${field}" in tango-showcase.json.\n` +
          '  site.js reads it for the homepage TANGO viewer; refusing to write a lossy export.',
      );
    }
    carried[field] = value;
  }
  return carried;
};

const webData = {
  generated_from: 'assets/tango/level_states/manifest.json',
  classification: manifest.classification,
  production_ready: manifest.production_ready,
  characters: [],
};

for (const character of manifest.characters) {
  const characterSlug = slugify(character.character_name);
  const webCharacterDir = path.posix.join('assets/tango-levels', characterSlug);
  const levelTwenty = character.levels.find((level) => level.level === 20);
  const thumbTarget = path.posix.join(
    'assets/tango-roster',
    `tango-${characterSlug}-level-20-thumb.webp`,
  );

  copyFromApp(levelTwenty.showcase.thumbnail, thumbTarget);

  // Key order matters: it must match the committed file so a no-op export
  // produces a clean `git status` rather than a whole-file reorder diff.
  const webCharacter = {
    id: character.character_id,
    name: character.character_name,
    slug: characterSlug,
    thumbnail: thumbTarget,
    ...carryCopyForward(character.character_id, character.character_name),
    levels: [],
  };

  for (const level of character.levels) {
    const imageTarget = path.posix.join(webCharacterDir, `level-${levelNumber(level.level)}.webp`);
    copyFromApp(level.showcase.hero, imageTarget);
    webCharacter.levels.push({
      level: level.level,
      slug: level.slug,
      name: `Level ${level.level}: ${titleCase(level.slug)}`,
      image: imageTarget,
    });
  }

  webData.characters.push(webCharacter);
}

const rook = manifest.characters.find((character) => character.character_id === 'tango_1');
const rookLevelOne = rook.levels.find((level) => level.level === 1);
const rookLevelTwenty = rook.levels.find((level) => level.level === 20);
copyFromApp(
  rookLevelOne.plain.hero,
  path.posix.join('assets/tango-roster', 'tango-rook-level-1-plain.webp'),
);
copyFromApp(
  rookLevelTwenty.showcase.hero,
  path.posix.join('assets/tango-roster', 'tango-rook-level-20.webp'),
);

fs.writeFileSync(showcasePath, `${JSON.stringify(webData, null, 2)}\n`);

console.log(
  `Exported ${webData.characters.length} TANGOs and ${webData.characters.length * 20} level images`,
);
