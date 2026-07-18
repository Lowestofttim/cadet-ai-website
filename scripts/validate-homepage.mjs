import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assetPath = (file) => file.split(/[?#]/)[0];
const exists = (file) => fs.existsSync(path.join(root, assetPath(file)));

const index = read('index.html');
const styles = read('styles.css');
const siteJs = read('site.js');

assert.match(index, /assets\/tango-roster\/tango-rook-level-1-plain\.webp/, 'Meet TANGO should use a plain/no-background runtime TANGO image');
assert.doesNotMatch(index, /assets\/tango\.(?:webp|png)/, 'Homepage should not use the stale generic TANGO mascot image');
assert.match(index, /data-tango-viewer/, 'Homepage should include an accessible TANGO viewer dialog');
assert.match(index, /data-tango-open/g, 'Roster should expose TANGO open buttons');
assert.match(index, /data-subject-preview/, 'Subject section should include an interactive preview panel');
assert.match(index, /site\.js\?v=/, 'Homepage should cache-bust the interaction script');
assert.match(siteJs, /function tangoViewer\(/, 'site.js should initialise the TANGO viewer');
assert.match(siteJs, /XMLHttpRequest/, 'TANGO viewer should have a non-fetch JSON loading fallback');
assert.doesNotMatch(siteJs, /levelIndex\s*=\s*current\s*&&\s*current\.levels\s*\?\s*current\.levels\.length\s*-\s*1\s*:\s*0/, 'TANGO viewer should not open characters at their final level');
assert.match(siteJs, /levelIndex\s*=\s*0;\s*levelsRendered\s*=\s*false;\s*update\(\);/, 'TANGO viewer should open each character at level 1 before users scroll');
assert.match(siteJs, /function subjectPreview\(/, 'site.js should initialise the subject preview');
assert.match(siteJs, /document\.readyState/, 'site.js should initialise even if DOMContentLoaded has already fired');
assert.match(siteJs, /audio\.playbackRate\s*=\s*rate/, 'Voice player should apply per-TANGO launch speaking-rate tuning');
assert.match(siteJs, /voiceSampleVersion\s*=\s*'20260715-premium-voices'/, 'Voice player should cache-bust the latest premium voice samples');
assert.match(siteJs, /versionedAudioSrc\(card\.getAttribute\('data-src'\)\)/, 'Voice player should version TANGO voice sample URLs');
assert.match(styles, /\.tango-modal/, 'styles.css should style the TANGO viewer modal');
assert.match(styles, /\.subject-preview/, 'styles.css should style the subject preview');
assert.match(styles, /\.voice-card\.elite/, 'Elite Pro voice cards should have distinct premium styling');

const dataPath = 'assets/tango-roster/tango-showcase.json';
assert.ok(exists(dataPath), 'TANGO showcase JSON should exist');
const data = JSON.parse(read(dataPath));
assert.equal(data.characters.length, 20, 'TANGO showcase should include all 20 characters');

for (const character of data.characters) {
  assert.ok(character.id, 'Each TANGO needs an id');
  assert.ok(character.name, `${character.id} needs a name`);
  assert.ok(character.thumbnail && exists(character.thumbnail), `${character.name} thumbnail should exist`);
  assert.equal(character.levels.length, 20, `${character.name} should include 20 levels`);
  character.levels.forEach((level, index) => {
    const expectedLevel = index + 1;
    const expectedImage = `assets/tango-levels/${character.slug}/level-${String(expectedLevel).padStart(3, '0')}.webp`;
    assert.equal(level.level, expectedLevel, `${character.name} levels should be ordered 1-20`);
    assert.equal(level.image, expectedImage, `${character.name} level ${expectedLevel} should point at the ordered level image`);
    assert.ok(level.name, `${character.name} level ${level.level} needs a display name`);
    assert.ok(level.image && exists(level.image), `${character.name} level ${level.level} image should exist`);
  });
}

const subjectButtonCount = (index.match(/data-subject="/g) || []).length;
assert.ok(subjectButtonCount >= 10, 'Subject preview should include at least 10 subject buttons');

const expectedVoiceRates = new Map([
  ['tango_1', '0.94'],
  ['tango_2', '0.86'],
  ['tango_3', '0.91'],
  ['tango_4', '0.84'],
  ['tango_5', '0.96'],
  ['tango_6', '0.80'],
  ['tango_7', '0.99'],
  ['tango_8', '0.93'],
  ['tango_9', '0.88'],
  ['tango_10', '0.98'],
  ['tango_11', '0.90'],
  ['tango_12', '0.91'],
  ['tango_13', '1.02'],
  ['tango_14', '0.95'],
  ['tango_15', '0.78'],
  ['tango_16', '0.84'],
  ['tango_17', '0.92'],
  ['tango_18', '0.89'],
  ['tango_19', '0.82'],
  ['tango_20', '0.87'],
]);
const proVoiceIds = new Set(['tango_6', 'tango_15', 'tango_16', 'tango_19', 'tango_20']);
const voiceCardMatches = [...index.matchAll(/<button class="voice-card([^"]*)"[^>]*data-voice="(tango_\d+)"[^>]*data-src="([^"]+)"[^>]*data-rate="([^"]+)"[^>]*data-tier="([^"]+)"/g)];
assert.equal(voiceCardMatches.length, 20, 'Homepage should expose all 20 TANGO voice previews');
for (const [, classes, id, src, rate, tier] of voiceCardMatches) {
  assert.ok(expectedVoiceRates.has(id), `${id} should be a known TANGO voice`);
  assert.equal(rate, expectedVoiceRates.get(id), `${id} should use the app launch speaking-rate tuning`);
  assert.ok(exists(src), `${id} voice preview audio should exist`);
  if (proVoiceIds.has(id)) {
    assert.match(classes, /\belite\b/, `${id} should be visually marked as elite`);
    assert.equal(tier, 'Elite Pro HD voice', `${id} should be labelled Elite Pro HD voice`);
  } else {
    assert.equal(tier, 'Premium HD voice', `${id} should be labelled Premium HD voice`);
  }
}

for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
  const html = read(file);
  assert.doesNotMatch(html, /Fish Audio/i, `${file} should use provider-neutral premium voice wording`);
  assert.doesNotMatch(html, /chirp/i, `${file} should not mention legacy voice provider wording`);
  assert.doesNotMatch(html, /Coming soon to Google Play/i, `${file} should not use stale Google Play coming-soon wording`);
  assert.doesNotMatch(html, /Coming soon\./i, `${file} should not use stale generic coming-soon CTA copy`);
  assert.match(html, /privacy\.html/, `${file} should link to Privacy Policy`);
  assert.match(html, /terms\.html/, `${file} should link to Terms of Use`);
  assert.match(html, /delete-account\.html/, `${file} should link to account deletion`);
  assert.match(html, /support@cadetai\.co\.uk/, `${file} should expose support contact`);
}

console.log('Homepage validation passed');
