import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { createVgaPalette, decodeMaze, encodeMaze, parsePascalLoads, parseZones } from './extract-assets.mjs';

describe('original data extraction', () => {
  it('ignores commented Pascal asset loads', () => {
    const source = "assign(g, 'one.dat');datadoasm; { assign(g, 'old.dat');datadoasm; }";
    expect(parsePascalLoads(source, 'datadoasm')).toEqual(['ONE.DAT']);
  });

  it('round-trips a compact maze', () => {
    const body = Buffer.alloc(125);
    body[0] = 0b10100001;
    const maze = decodeMaze(Buffer.concat([Buffer.from([40, 25]), body]), 'test', 'TEST.DAT');
    expect(maze.rows[0].slice(0, 8)).toBe('#.#....#');
    expect(encodeMaze(maze)).toEqual(body);
  });

  it.skipIf(!existsSync(new URL('../../H_ESC_3/ATEST.ASM', import.meta.url)))('parses all active zone records from the original ASM', async () => {
    const { readFile } = await import('node:fs/promises');
    const asm = await readFile(new URL('../../H_ESC_3/ATEST.ASM', import.meta.url), 'latin1');
    const zones = parseZones(asm);
    expect(zones).toHaveLength(42);
    expect(zones[0]).toMatchObject({ mazeIndex: 3, wallSpriteIndex: 21, enemyCount: 8, speedTicks: 13 });
    expect(zones[41]).toMatchObject({ mazeIndex: 42, enemyCount: 5 });
  });

  it('reproduces the BIOS mode 13h palette used by indexed sprites', () => {
    const palette = createVgaPalette();
    expect(palette).toHaveLength(256);
    expect(palette[31]).toBe('#ffffff');
    expect(palette[32]).toBe('#0000ff');
    expect(palette[48]).toBe('#00ff00');
    expect(palette[89]).toBe('#ffc6b6');
    expect(palette[114]).toBe('#713900');
  });
});
