import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const siteRoot = process.cwd();
const appRoot = process.env.CADET_APP_ROOT || path.resolve(siteRoot, '..', 'Cadet training docs');
const appManifestPath = path.join(appRoot, 'assets', 'tango', 'level_states', 'manifest.json');
const siteManifestPath = path.join(siteRoot, 'assets', 'tango-roster', 'tango-showcase.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// NOTE: this validator needs a checkout of the APP repo as well as this one, so
// it deliberately is NOT part of the pull-request gate — see
// .github/workflows/tango-asset-parity.yml for the reasoning, and run it there
// (or locally, as below) instead.
//
// It fails rather than skips when the app checkout is missing, on purpose: a
// validator that exits 0 because it could not find anything to check is worse
// than no validator, because it reports success having verified nothing.
assert.ok(
  fs.existsSync(appManifestPath),
  `App TANGO manifest missing: ${appManifestPath}\n` +
    'This check compares this site against the app repo\'s runtime export, so it\n' +
    'needs a checkout of Lowestofttim/Cadet-AI. Either clone it next to this repo\n' +
    'as "Cadet training docs", or point CADET_APP_ROOT at it:\n' +
    '  CADET_APP_ROOT=/path/to/Cadet-AI node scripts/validate-tango-web-assets-from-app.mjs\n' +
    'In CI it runs from .github/workflows/tango-asset-parity.yml (Actions -> Run workflow).',
);
assert.ok(fs.existsSync(siteManifestPath), `Website TANGO showcase data missing: ${siteManifestPath}`);

const appManifest = readJson(appManifestPath);
const siteManifest = readJson(siteManifestPath);
assert.equal(
  appManifest.progression_policy?.model,
  'curated_linear_level_ladder',
  'App TANGO manifest should use the curated linear ladder progression model',
);
assert.equal(
  appManifest.progression_policy?.carry_forward_visual_details,
  true,
  'App TANGO manifest should preserve visual upgrades across levels',
);
assert.equal(siteManifest.characters.length, appManifest.characters.length, 'Website TANGO count should match app manifest');

let checkedImages = 0;

for (const appCharacter of appManifest.characters) {
  const slug = slugify(appCharacter.character_name);
  const siteCharacter = siteManifest.characters.find((character) => character.id === appCharacter.character_id);
  assert.ok(siteCharacter, `${appCharacter.character_name} should exist in website showcase data`);
  assert.equal(siteCharacter.slug, slug, `${appCharacter.character_name} slug should match export script`);
  assert.equal(siteCharacter.levels.length, 20, `${appCharacter.character_name} website levels should include 1-20`);

  appCharacter.levels.forEach((appLevel, index) => {
    const expectedLevel = index + 1;
    assert.equal(appLevel.level, expectedLevel, `${appCharacter.character_name} app levels should be ordered 1-20`);
    assert.equal(
      siteCharacter.levels[index]?.level,
      expectedLevel,
      `${appCharacter.character_name} website levels should be ordered 1-20`,
    );
    const levelNumber = String(appLevel.level).padStart(3, '0');
    const siteRelativePath = path.join('assets', 'tango-levels', slug, `level-${levelNumber}.webp`);
    assert.equal(
      siteCharacter.levels[index]?.image,
      siteRelativePath.replaceAll(path.sep, '/'),
      `${appCharacter.character_name} level ${expectedLevel} website image should match the ordered level file`,
    );
    const appImagePath = path.join(appRoot, appLevel.showcase.hero);
    const siteImagePath = path.join(siteRoot, siteRelativePath);

    assert.ok(fs.existsSync(siteImagePath), `${siteRelativePath} should exist`);
    assert.equal(
      sha256(siteImagePath),
      sha256(appImagePath),
      `${siteRelativePath} should match the current app showcase export`,
    );
    checkedImages += 1;
  });

  const levelTwenty = appCharacter.levels.find((level) => level.level === 20);
  const thumbRelativePath = path.join('assets', 'tango-roster', `tango-${slug}-level-20-thumb.webp`);
  assert.equal(
    sha256(path.join(siteRoot, thumbRelativePath)),
    sha256(path.join(appRoot, levelTwenty.showcase.thumbnail)),
    `${thumbRelativePath} should match the current app showcase thumbnail`,
  );
  checkedImages += 1;
}

const rook = appManifest.characters.find((character) => character.character_id === 'tango_1');
const rookLevelOne = rook.levels.find((level) => level.level === 1);
const rookLevelTwenty = rook.levels.find((level) => level.level === 20);
assert.equal(
  sha256(path.join(siteRoot, 'assets', 'tango-roster', 'tango-rook-level-1-plain.webp')),
  sha256(path.join(appRoot, rookLevelOne.plain.hero)),
  'Meet TANGO plain image should match the current app plain export',
);
checkedImages += 1;
assert.equal(
  sha256(path.join(siteRoot, 'assets', 'tango-roster', 'tango-rook-level-20.webp')),
  sha256(path.join(appRoot, rookLevelTwenty.showcase.hero)),
  'Homepage Rook level 20 showcase image should match the current app showcase export',
);
checkedImages += 1;

for (const fileName of fs.readdirSync(siteRoot).filter((name) => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(siteRoot, fileName), 'utf8');
  assert.doesNotMatch(
    html,
    /assets\/tango\.(?:webp|png)/,
    `${fileName} should use exported runtime TANGO artwork, not the stale generic mascot file`,
  );
}

console.log(`Website TANGO assets match app exports: ${checkedImages} images checked`);
