import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('search discovery exposes the editorial policy and install-intent guides', () => {
  const requiredPages = [
    'about.html',
    'guides/army-cadet-revision-app.html',
    'guides/cadet-portal-and-cadet-ai.html',
  ];
  const sitemap = read('sitemap.xml');
  const guideHub = read('guides/index.html');
  const llms = read('llms.txt');

  for (const page of requiredPages) {
    assert.ok(fs.existsSync(path.join(root, page)), page + ' must exist');
    const url = 'https://cadetai.co.uk/' + page;
    assert.ok(sitemap.includes('<loc>' + url + '</loc>'), url + ' must be in sitemap.xml');
  }

  assert.match(guideHub, /army-cadet-revision-app\.html/);
  assert.match(guideHub, /cadet-portal-and-cadet-ai\.html/);
  assert.match(llms, /https:\/\/cadetai\.co\.uk\/about\.html/);
  assert.match(llms, /army-cadet-revision-app\.html/);
});

test('guide articles show review provenance that matches their structured data', () => {
  const guideFiles = fs
    .readdirSync(path.join(root, 'guides'))
    .filter((name) => name.endsWith('.html') && name !== 'index.html');

  for (const name of guideFiles) {
    const html = read(path.join('guides', name));
    if (!/"@type":\s*"Article"/.test(html)) continue;

    assert.match(html, /class="content-review"/, name + ' needs visible review provenance');
    assert.match(html, /id="sources"/, name + ' needs a visible sources section');
    assert.match(html, /"dateModified":\s*"\d{4}-\d{2}-\d{2}"/, name + ' needs dateModified');
    assert.match(
      html,
      /"publishingPrinciples":\s*"https:\/\/cadetai\.co\.uk\/about\.html#editorial-policy"/,
      name + ' must point to the editorial policy',
    );
  }
});

test('public discovery copy reflects availability on both app stores', () => {
  const llms = read('llms.txt');
  const guideHub = read('guides/index.html');

  assert.doesNotMatch(llms, /Android only/i);
  assert.match(llms, /App Store/);
  assert.match(llms, /Google Play/);
  assert.doesNotMatch(guideHub, /An Android app/i);
  assert.match(guideHub, /iPhone, iPad and Android/i);
});
