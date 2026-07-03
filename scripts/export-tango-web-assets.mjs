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

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const titleCase = (value) =>
  value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const copyFromApp = (relativeSource, relativeTarget) => {
  const source = path.join(appRoot, relativeSource);
  const target = path.join(siteRoot, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
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

  const webCharacter = {
    id: character.character_id,
    name: character.character_name,
    slug: characterSlug,
    thumbnail: thumbTarget,
    levels: [],
  };

  for (const level of character.levels) {
    const levelNumber = String(level.level).padStart(3, '0');
    const imageTarget = path.posix.join(webCharacterDir, `level-${levelNumber}.webp`);
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
copyFromApp(
  rookLevelOne.plain.hero,
  path.posix.join('assets/tango-roster', 'tango-rook-level-1-plain.webp'),
);

fs.writeFileSync(
  path.join(rosterDir, 'tango-showcase.json'),
  `${JSON.stringify(webData, null, 2)}\n`,
);

console.log(
  `Exported ${webData.characters.length} TANGOs and ${webData.characters.length * 20} level images`,
);
