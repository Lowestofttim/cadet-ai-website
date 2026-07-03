import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const index = read('index.html');
const styles = read('styles.css');
const siteJs = read('site.js');

assert.match(index, /assets\/tango-roster\/tango-rook-level-1-plain\.webp/, 'Meet TANGO should use a plain/no-background runtime TANGO image');
assert.match(index, /data-tango-viewer/, 'Homepage should include an accessible TANGO viewer dialog');
assert.match(index, /data-tango-open/g, 'Roster should expose TANGO open buttons');
assert.match(index, /data-subject-preview/, 'Subject section should include an interactive preview panel');
assert.match(index, /site\.js\?v=/, 'Homepage should cache-bust the interaction script');
assert.match(siteJs, /function tangoViewer\(/, 'site.js should initialise the TANGO viewer');
assert.match(siteJs, /XMLHttpRequest/, 'TANGO viewer should have a non-fetch JSON loading fallback');
assert.match(siteJs, /function subjectPreview\(/, 'site.js should initialise the subject preview');
assert.match(siteJs, /document\.readyState/, 'site.js should initialise even if DOMContentLoaded has already fired');
assert.match(styles, /\.tango-modal/, 'styles.css should style the TANGO viewer modal');
assert.match(styles, /\.subject-preview/, 'styles.css should style the subject preview');

const dataPath = 'assets/tango-roster/tango-showcase.json';
assert.ok(exists(dataPath), 'TANGO showcase JSON should exist');
const data = JSON.parse(read(dataPath));
assert.equal(data.characters.length, 20, 'TANGO showcase should include all 20 characters');

for (const character of data.characters) {
  assert.ok(character.id, 'Each TANGO needs an id');
  assert.ok(character.name, `${character.id} needs a name`);
  assert.ok(character.thumbnail && exists(character.thumbnail), `${character.name} thumbnail should exist`);
  assert.equal(character.levels.length, 20, `${character.name} should include 20 levels`);
  for (const level of character.levels) {
    assert.ok(level.name, `${character.name} level ${level.level} needs a display name`);
    assert.ok(level.image && exists(level.image), `${character.name} level ${level.level} image should exist`);
  }
}

const subjectButtonCount = (index.match(/data-subject="/g) || []).length;
assert.ok(subjectButtonCount >= 10, 'Subject preview should include at least 10 subject buttons');

for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
  const html = read(file);
  assert.doesNotMatch(html, /Coming soon to Google Play/i, `${file} should not use stale Google Play coming-soon wording`);
  assert.doesNotMatch(html, /Coming soon\./i, `${file} should not use stale generic coming-soon CTA copy`);
  assert.match(html, /privacy\.html/, `${file} should link to Privacy Policy`);
  assert.match(html, /terms\.html/, `${file} should link to Terms of Use`);
  assert.match(html, /delete-account\.html/, `${file} should link to account deletion`);
  assert.match(html, /support@cadetai\.co\.uk/, `${file} should expose support contact`);
}

console.log('Homepage validation passed');
