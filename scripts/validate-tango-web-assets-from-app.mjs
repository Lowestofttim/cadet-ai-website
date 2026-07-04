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

assert.ok(fs.existsSync(appManifestPath), `App TANGO manifest missing: ${appManifestPath}`);
assert.ok(fs.existsSync(siteManifestPath), `Website TANGO showcase data missing: ${siteManifestPath}`);

const appManifest = readJson(appManifestPath);
const siteManifest = readJson(siteManifestPath);
assert.equal(siteManifest.characters.length, appManifest.characters.length, 'Website TANGO count should match app manifest');

let checkedImages = 0;

for (const appCharacter of appManifest.characters) {
  const slug = slugify(appCharacter.character_name);
  const siteCharacter = siteManifest.characters.find((character) => character.id === appCharacter.character_id);
  assert.ok(siteCharacter, `${appCharacter.character_name} should exist in website showcase data`);
  assert.equal(siteCharacter.slug, slug, `${appCharacter.character_name} slug should match export script`);

  for (const appLevel of appCharacter.levels) {
    const levelNumber = String(appLevel.level).padStart(3, '0');
    const siteRelativePath = path.join('assets', 'tango-levels', slug, `level-${levelNumber}.webp`);
    const appImagePath = path.join(appRoot, appLevel.showcase.hero);
    const siteImagePath = path.join(siteRoot, siteRelativePath);

    assert.ok(fs.existsSync(siteImagePath), `${siteRelativePath} should exist`);
    assert.equal(
      sha256(siteImagePath),
      sha256(appImagePath),
      `${siteRelativePath} should match the current app showcase export`,
    );
    checkedImages += 1;
  }

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
assert.equal(
  sha256(path.join(siteRoot, 'assets', 'tango-roster', 'tango-rook-level-1-plain.webp')),
  sha256(path.join(appRoot, rookLevelOne.plain.hero)),
  'Meet TANGO plain image should match the current app plain export',
);
checkedImages += 1;

console.log(`Website TANGO assets match app exports: ${checkedImages} images checked`);
