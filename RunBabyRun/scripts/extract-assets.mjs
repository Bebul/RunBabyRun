import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(ROOT, '..', 'H_ESC_3');
const OUTPUT = path.join(ROOT, 'public', 'generated');
const WIDTH = 40;
const HEIGHT = 25;
const ACTIVE_ZONE_COUNT = 42;

const EGA16 = [
  '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];

export function createVgaPalette() {
  const palette = EGA16.map(hexToRgb);
  for (let i = 0; i < 16; i += 1) {
    const value = Math.round((i / 15) * 255);
    palette.push([value, value, value]);
  }
  const levels = [0, 51, 102, 153, 204, 255];
  for (const red of levels) for (const green of levels) for (const blue of levels) palette.push([red, green, blue]);
  while (palette.length < 256) palette.push([0, 0, 0]);
  return palette;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function stripPascalComments(text) {
  return text.replace(/\{[\s\S]*?\}/g, '');
}

export function parsePascalLoads(text, procedure) {
  const clean = stripPascalComments(text);
  const pattern = new RegExp(`assign\\(g,\\s*'([^']+)'\\);\\s*${procedure}`, 'gi');
  return [...clean.matchAll(pattern)].map((match) => match[1].toUpperCase());
}

export function decodeMaze(buffer, id, source) {
  if (buffer.length !== 127) throw new Error(`${source}: očekáváno 127 bajtů, nalezeno ${buffer.length}`);
  const body = buffer.subarray(2);
  const rows = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    let row = '';
    for (let byte = 0; byte < 5; byte += 1) {
      const value = body[y * 5 + byte];
      for (let bit = 7; bit >= 0; bit -= 1) row += value & (1 << bit) ? '#' : '.';
    }
    rows.push(row);
  }
  return { id, source, width: WIDTH, height: HEIGHT, rows, checksum: sha256(body) };
}

export function encodeMaze(maze) {
  const bytes = Buffer.alloc(125);
  maze.rows.forEach((row, y) => {
    if (row.length !== WIDTH) throw new Error(`${maze.id}: řádek ${y} nemá ${WIDTH} buněk`);
    for (let x = 0; x < WIDTH; x += 1) if (row[x] === '#') bytes[y * 5 + Math.floor(x / 8)] |= 1 << (7 - (x % 8));
  });
  return bytes;
}

export function decodeSprite(buffer, id, source) {
  const width = buffer[0];
  const height = buffer[1];
  const expected = 2 + width * height;
  if (!width || !height || buffer.length !== expected) {
    throw new Error(`${source}: rozměry ${width}×${height} vyžadují ${expected} bajtů, nalezeno ${buffer.length}`);
  }
  return { id, source, width, height, pixels: [...buffer.subarray(2)], checksum: sha256(buffer.subarray(2)) };
}

function parseNumberList(fragment) {
  return fragment
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^-?\d+$/.test(value))
    .map(Number);
}

export function parseZones(asmText) {
  const table = asmText.match(/gametable:\s*([\s\S]*?)\n\s*\n\s*pohybdata:/i)?.[1];
  if (!table) throw new Error('V ASM nebyla nalezena gametable.');
  const labels = [...table.matchAll(/\bdw\s+([^;\r\n]+)/gi)]
    .flatMap((match) => match[1].split(','))
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, ACTIVE_ZONE_COUNT);

  return labels.map((label, index) => {
    const start = asmText.search(new RegExp(`^${label}:?\\s`, 'im'));
    if (start < 0) throw new Error(`Chybí definice zóny ${label}.`);
    const nextPositions = labels
      .slice(index + 1)
      .map((next) => asmText.search(new RegExp(`^${next}:?\\s`, 'im')))
      .filter((position) => position > start);
    const end = nextPositions.length ? Math.min(...nextPositions) : asmText.search(/^\s*praxtable\s+/im);
    const block = asmText.slice(start, end);
    const byteValues = [...block.matchAll(/\bdb\s+([^;\r\n]+)/gi)].flatMap((match) => parseNumberList(match[1]));
    const wordValues = [...block.matchAll(/\bdw\s+([^;\r\n]+)/gi)].flatMap((match) => parseNumberList(match[1]));
    if (byteValues.length < 4 || wordValues.length < 8) throw new Error(`${label}: neúplná konfigurace zóny.`);
    return {
      number: index + 1,
      sourceLabel: label,
      mazeIndex: byteValues[0],
      wallSpriteIndex: byteValues[1],
      enemyCount: byteValues[2],
      speedTicks: byteValues[3],
      enemyTrackOffsets: wordValues.slice(0, byteValues[2]),
    };
  });
}

function makeId(prefix, filename, index) {
  return `${prefix}-${String(index).padStart(2, '0')}-${path.parse(filename).name.toLowerCase()}`;
}

function packSprites(sprites) {
  const atlasWidth = 256;
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  for (const sprite of sprites) {
    if (x + sprite.width > atlasWidth) {
      x = 0;
      y += shelfHeight + 1;
      shelfHeight = 0;
    }
    sprite.atlas = { x, y, width: sprite.width, height: sprite.height };
    x += sprite.width + 1;
    shelfHeight = Math.max(shelfHeight, sprite.height);
  }
  return { width: atlasWidth, height: y + shelfHeight };
}

function renderAtlas(sprites, size, palette) {
  const png = new PNG({ width: size.width, height: size.height, colorType: 6 });
  png.data.fill(0);
  for (const sprite of sprites) {
    sprite.pixels.forEach((colorIndex, offset) => {
      const sx = offset % sprite.width;
      const sy = Math.floor(offset / sprite.width);
      const target = ((sprite.atlas.y + sy) * size.width + sprite.atlas.x + sx) * 4;
      const [red, green, blue] = palette[colorIndex];
      png.data[target] = red;
      png.data[target + 1] = green;
      png.data[target + 2] = blue;
      png.data[target + 3] = 255;
    });
  }
  return PNG.sync.write(png, { colorType: 6 });
}

async function writeJson(filename, value) {
  await writeFile(path.join(OUTPUT, filename), `${JSON.stringify(value, null, 2)}\n`);
}

export async function extract({ sourceDir = SOURCE, outputDir = OUTPUT } = {}) {
  const previousOutput = OUTPUT;
  if (outputDir !== previousOutput) throw new Error('Vlastní outputDir zatím není podporován.');
  const pasBuffer = await readFile(path.join(sourceDir, 'ATEST.PAS'));
  const asmBuffer = await readFile(path.join(sourceDir, 'ATEST.ASM'));
  const pasText = pasBuffer.toString('latin1');
  const asmText = asmBuffer.toString('latin1');
  const imageFiles = parsePascalLoads(pasText, 'datadoasm');
  const mazeFiles = parsePascalLoads(pasText, 'databludist');
  const rawZones = parseZones(asmText);
  const errors = [];

  const mazes = [];
  for (const [index, filename] of mazeFiles.entries()) {
    const buffer = await readFile(path.join(sourceDir, filename));
    const maze = decodeMaze(buffer, index === 0 ? 'menu' : `maze-${String(index).padStart(2, '0')}`, filename);
    if (!encodeMaze(maze).equals(buffer.subarray(2))) errors.push(`${filename}: zpětné zakódování se liší.`);
    mazes.push(maze);
  }

  const sprites = [];
  for (const [index, filename] of imageFiles.entries()) {
    const buffer = await readFile(path.join(sourceDir, filename));
    sprites.push(decodeSprite(buffer, makeId('sprite', filename, index + 1), filename));
  }

  const zones = rawZones.map((zone) => ({
    number: zone.number,
    sourceLabel: zone.sourceLabel,
    mazeId: mazes[zone.mazeIndex]?.id,
    wallSpriteId: sprites[zone.wallSpriteIndex - 1]?.id,
    playerSpriteId: sprites[1]?.id,
    enemySpriteIds: Array.from({ length: zone.enemyCount }, (_, index) => sprites[index + 2]?.id),
    enemyCount: zone.enemyCount,
    speedTicks: zone.speedTicks,
    enemyTrackOffsets: zone.enemyTrackOffsets,
  }));

  for (const zone of zones) {
    if (!zone.mazeId) errors.push(`Zóna ${zone.number}: neplatný odkaz na mapu.`);
    if (!zone.wallSpriteId) errors.push(`Zóna ${zone.number}: neplatný odkaz na zeď.`);
    if (zone.enemySpriteIds.some((id) => !id)) errors.push(`Zóna ${zone.number}: chybí sprite soupeře.`);
    if (zone.enemyTrackOffsets.some((offset) => offset < 0 || offset > 315)) errors.push(`Zóna ${zone.number}: offset soupeře mimo rozsah.`);
  }
  if (mazes.length !== 43) errors.push(`Očekáváno 43 mapových vstupů, nalezeno ${mazes.length}.`);
  if (sprites.length !== 46) errors.push(`Očekáváno 46 aktivních obrázků, nalezeno ${sprites.length}.`);
  if (zones.length !== ACTIVE_ZONE_COUNT) errors.push(`Očekáváno 42 zón, nalezeno ${zones.length}.`);

  const palette = createVgaPalette();
  const atlasSize = packSprites(sprites);
  const atlasBuffer = renderAtlas(sprites, atlasSize, palette);
  const sourceFiles = await readdir(sourceDir);
  const used = new Set(['ATEST.PAS', 'ATEST.ASM', ...imageFiles, ...mazeFiles].map((name) => name.toUpperCase()));
  const report = {
    generated: true,
    formatVersion: 1,
    counts: { playableMazes: mazes.length - 1, menuMazes: 1, sprites: sprites.length, zones: zones.length },
    sourceHashes: { 'ATEST.PAS': sha256(pasBuffer), 'ATEST.ASM': sha256(asmBuffer) },
    usedFiles: [...used].sort(),
    unusedFiles: sourceFiles.filter((name) => !used.has(name.toUpperCase())).sort(),
    atlas: { ...atlasSize, checksum: sha256(atlasBuffer) },
    errors,
  };

  await mkdir(OUTPUT, { recursive: true });
  await writeJson('mazes.json', { generated: true, formatVersion: 1, mazes });
  await writeJson('sprites.json', {
    generated: true,
    formatVersion: 1,
    atlas: { file: 'atlas.png', ...atlasSize },
    palette,
    sprites: sprites.map(({ pixels, ...metadata }) => metadata),
  });
  await writeJson('zones.json', { generated: true, formatVersion: 1, zones });
  await writeJson('conversion-report.json', report);
  await writeFile(path.join(OUTPUT, 'atlas.png'), atlasBuffer);
  if (errors.length) throw new Error(`Převod skončil s ${errors.length} chybami:\n${errors.join('\n')}`);
  return report;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedFile) {
  const report = await extract();
  console.log(`Převedeno ${report.counts.playableMazes} bludišť, ${report.counts.sprites} obrázků a ${report.counts.zones} zón.`);
  console.log(`Atlas ${report.atlas.width}×${report.atlas.height}; validační chyby: ${report.errors.length}.`);
}
