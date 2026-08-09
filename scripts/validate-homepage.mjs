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
const siteScriptVersion = '20260723-nav-a11y-1';
const siteStyleVersion = '20260723-nav-a11y-1';
const voiceSampleVersion = '20260719-launch-copy-1';

assert.doesNotMatch(siteJs, /\u00e2|\uFFFD|\uFEFF/, 'site.js should not contain mojibake or a byte-order mark');
assert.doesNotMatch(index, /\u00e2|\uFFFD|\uFEFF/, 'Homepage should not contain mojibake or a byte-order mark');
assert.doesNotMatch(styles, /\u00e2|\uFFFD|\uFEFF/, 'styles.css should not contain mojibake or a byte-order mark');
assert.match(index, /id="latest-tiktok"/, 'Homepage should include a Latest TikTok section near the top');
assert.match(index, /class="tiktok-embed"[\s\S]*data-embed-type="creator"/, 'Latest TikTok should embed a TikTok creator feed');
assert.match(index, /class="tiktok-embed"[\s\S]*data-unique-id="cadet\.ai"/, 'Latest TikTok should embed the Cadet AI creator feed');
assert.match(index, /https:\/\/www\.tiktok\.com\/embed\.js/, 'Homepage should load the official TikTok embed script');
assert.match(index, /id="follow-cadet-ai"/, 'Homepage should include a follow-us social panel');

const expectedSocialLinks = [
  'https://www.tiktok.com/@cadet.ai',
  'https://www.instagram.com/cadet.ai.uk/',
  'https://www.threads.com/@cadet.ai.uk',
  'https://www.youtube.com/channel/UCXoPFul6l53mZeoD3Crftbw/shorts',
  'https://x.com/CadetAIUK',
  'https://www.facebook.com/profile.php?id=61592097923509',
];
for (const href of expectedSocialLinks) {
  assert.match(index, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Homepage should link to ${href}`);
}
assert.match(index, /assets\/tango-roster\/tango-rook-level-1-plain\.webp/, 'Meet TANGO should use a plain/no-background runtime TANGO image');
assert.doesNotMatch(index, /assets\/tango\.(?:webp|png)/, 'Homepage should not use the stale generic TANGO mascot image');
assert.match(index, /data-tango-viewer/, 'Homepage should include an accessible TANGO viewer dialog');
assert.match(index, /data-tango-open/g, 'Roster should expose TANGO open buttons');
assert.match(index, /data-subject-preview/, 'Subject section should include an interactive preview panel');
assert.match(index, new RegExp(`site\\.js\\?v=${siteScriptVersion}`), 'Homepage should cache-bust the latest interaction script');
assert.match(index, new RegExp(`styles\\.css\\?v=${siteStyleVersion}`), 'Homepage should cache-bust the latest shared styles');
assert.match(siteJs, /function tangoViewer\(/, 'site.js should initialise the TANGO viewer');
assert.match(siteJs, /XMLHttpRequest/, 'TANGO viewer should have a non-fetch JSON loading fallback');
assert.doesNotMatch(siteJs, /levelIndex\s*=\s*current\s*&&\s*current\.levels\s*\?\s*current\.levels\.length\s*-\s*1\s*:\s*0/, 'TANGO viewer should not open characters at their final level');
assert.match(siteJs, /levelIndex\s*=\s*0;\s*levelsRendered\s*=\s*false;\s*update\(\);/, 'TANGO viewer should open each character at level 1 before users scroll');
assert.match(siteJs, /function subjectPreview\(/, 'site.js should initialise the subject preview');
assert.match(siteJs, /document\.readyState/, 'site.js should initialise even if DOMContentLoaded has already fired');
assert.match(siteJs, /aria-expanded/, 'Mobile navigation should expose its open state');
assert.match(siteJs, /event\.key !== 'Enter' && event\.key !== ' '/, 'Mobile navigation should support keyboard activation');
assert.match(siteJs, /audio\.playbackRate\s*=\s*rate/, 'Voice player should apply per-TANGO launch speaking-rate tuning');
assert.match(siteJs, new RegExp(`voiceSampleVersion\\s*=\\s*'${voiceSampleVersion}'`), 'Voice player should cache-bust the moderated matched voice tuning');
assert.match(siteJs, /versionedAudioSrc\(card\.getAttribute\('data-src'\)\)/, 'Voice player should version TANGO voice sample URLs');
assert.match(styles, /\.tango-modal/, 'styles.css should style the TANGO viewer modal');
assert.match(styles, /\.subject-preview/, 'styles.css should style the subject preview');
assert.match(styles, /\.voice-card\.elite/, 'Pro voice cards should have distinct matched voice styling');

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
  ['tango_1', '1.11'],
  ['tango_2', '1.09'],
  ['tango_3', '1.12'],
  ['tango_4', '1.08'],
  ['tango_5', '1.13'],
  ['tango_6', '1.09'],
  ['tango_7', '1.15'],
  ['tango_8', '1.11'],
  ['tango_9', '1.09'],
  ['tango_10', '1.14'],
  ['tango_11', '1.10'],
  ['tango_12', '1.11'],
  ['tango_13', '1.15'],
  ['tango_14', '1.13'],
  ['tango_15', '1.08'],
  ['tango_16', '1.10'],
  ['tango_17', '1.11'],
  ['tango_18', '1.09'],
  ['tango_19', '1.08'],
  ['tango_20', '1.10'],
]);
const proVoiceIds = new Set(['tango_16', 'tango_17', 'tango_18', 'tango_19', 'tango_20']);
for (const voicePage of ['index.html', 'plans.html']) {
  const html = read(voicePage);
  assert.ok(html.includes(`site.js?v=${siteScriptVersion}`), `${voicePage} should request the latest interaction script`);
  const voiceCardMatches = [...html.matchAll(/<button class="voice-card([^"]*)"[^>]*data-voice="(tango_\d+)"[^>]*data-src="([^"]+)"[^>]*data-rate="([^"]+)"[^>]*data-tier="([^"]+)"/g)];
  assert.equal(voiceCardMatches.length, 20, `${voicePage} should expose all 20 TANGO voice previews`);
  for (const [, classes, id, src, rate, tier] of voiceCardMatches) {
    const visibleTier = html.match(new RegExp(`data-voice="${id}"[\\s\\S]*?<span class="tier">([^<]+)<\\/span>`));
    assert.ok(expectedVoiceRates.has(id), `${voicePage} ${id} should be a known TANGO voice`);
    assert.equal(rate, expectedVoiceRates.get(id), `${voicePage} ${id} should use the moderated app launch speaking-rate tuning`);
    assert.ok(Number(rate) >= 1.05 && Number(rate) <= 1.20, `${voicePage} ${id} should sound naturally paced, not sped up`);
    assert.ok(exists(src), `${voicePage} ${id} voice preview audio should exist`);
    assert.ok(visibleTier, `${voicePage} ${id} should expose visible voice-tier copy`);
    assert.equal(visibleTier[1], tier, `${voicePage} ${id} visible voice-tier copy should match data-tier`);
    // Voices are locked per character: the badge shows the CHARACTER's plan
    // (Free 1-5, Plus 6-15, Pro 16-20), not a separate voice tier.
    const num = Number(id.replace('tango_', ''));
    const expectedTier = num <= 5 ? 'Free character' : num <= 15 ? 'Plus character' : 'Pro character';
    assert.equal(tier, expectedTier, `${voicePage} ${id} should be badged with its character's plan`);
    if (proVoiceIds.has(id)) {
      assert.match(classes, /\belite\b/, `${voicePage} ${id} should be visually marked as elite`);
    }
  }
}

const rootPublicHtml = fs
  .readdirSync(root)
  .filter((name) => name.endsWith('.html') && !/^google[a-z0-9]+\.html$/i.test(name));

for (const file of rootPublicHtml) {
  const html = read(file);
  assert.doesNotMatch(html, /Fish Audio/i, `${file} should use provider-neutral matched voice wording`);
  assert.doesNotMatch(html, /chirp/i, `${file} should not mention legacy voice provider wording`);
  assert.doesNotMatch(html, /Coming soon to Google Play/i, `${file} should not use stale Google Play coming-soon wording`);
  assert.doesNotMatch(html, /Coming soon\./i, `${file} should not use stale generic coming-soon CTA copy`);
  assert.match(html, /privacy\.html/, `${file} should link to Privacy Policy`);
  assert.match(html, /terms\.html/, `${file} should link to Terms of Use`);
  assert.match(html, /delete-account\.html/, `${file} should link to account deletion`);
  assert.match(html, /support@cadetai\.co\.uk/, `${file} should expose support contact`);
}

const llms = read('llms.txt');
assert.doesNotMatch(llms, /Coming soon to Google Play/i, 'llms.txt should not use stale Google Play coming-soon wording');
assert.doesNotMatch(llms, /not yet released/i, 'llms.txt should not describe the app as unreleased');
assert.doesNotMatch(llms, /Fish Audio/i, 'llms.txt should use provider-neutral matched voice wording');

const publicCopyFiles = [
  ...rootPublicHtml,
  ...fs.readdirSync(path.join(root, 'guides'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => `guides/${name}`),
  'llms.txt',
];
for (const file of publicCopyFiles) {
  const copy = read(file);
  assert.doesNotMatch(
    copy,
    /\b(?:all\s+)?(?:12|twelve)\s+(?:cadet\s+)?subjects?\b/i,
    `${file} should describe the current 13-subject catalogue`,
  );
  assert.doesNotMatch(
    copy,
    /\bneural voice(?:s)?\b/i,
    `${file} should use provider-neutral matched character voice wording`,
  );
}

const plans = read('plans.html');
assert.match(plans, /5 TANGO characters/, 'Free plan should disclose its five-character roster');
assert.match(plans, /5,000 text characters a day/, 'Plus should disclose its matched voice fair-use cap');
assert.match(plans, /8,000 text characters a day/, 'Pro should disclose its matched voice fair-use cap');
assert.match(
  plans,
  /Plus and Pro unlock matched answer playback/,
  'Plans should reserve matched answer playback for paid tiers',
);
assert.doesNotMatch(
  plans,
  /standard read-aloud stays free|Read-aloud answers/,
  'Plans should not promise free full-answer voice playback',
);

const faq = read('faq.html');
assert.doesNotMatch(
  faq,
  /read-aloud answers/i,
  'FAQ should not promise free full-answer voice playback',
);
assert.match(
  faq,
  /short TANGO voice reactions/,
  'FAQ should describe the bundled voice reactions available on Free',
);

const assetLinks = JSON.parse(read('.well-known/assetlinks.json'));
const fingerprints = assetLinks[0]?.target?.sha256_cert_fingerprints ?? [];
assert.ok(
  fingerprints.includes('16:D7:E4:98:7B:79:A0:8D:C3:66:75:F3:A3:75:D9:D1:E5:BB:88:0B:B5:17:32:44:D0:11:FD:BF:02:E7:AE:23'),
  'Digital Asset Links should retain the upload certificate',
);
assert.ok(
  fingerprints.includes('4C:95:E6:3B:66:10:D5:8C:95:76:B6:89:77:10:EE:90:5D:FC:D2:01:3B:23:4B:04:09:B4:A2:23:BE:64:1B:9F'),
  'Digital Asset Links should include the Play app-signing certificate',
);

const terms = read('terms.html');
assert.doesNotMatch(
  terms,
  /under 13,\s*you need a parent or guardian to set things up/i,
  'Terms should match the hard 13+ account gate, not imply parent-assisted under-13 signup',
);
assert.match(
  terms,
  /under-13s cannot create an account/i,
  'Terms should explicitly say under-13s cannot create an account',
);

console.log('Homepage validation passed');
