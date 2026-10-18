import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readExif } from '../src/exif-read.js';
import { groupFields, hasGps } from '../src/exif-groups.js';

it('baca JPEG contoh dengan GPS', async () => {
  const buf = readFileSync(new URL('./fixtures/sample.jpg', import.meta.url));
  const data = await readExif(buf);
  expect(data.Model).toBe('TestModel');
  expect(hasGps(data)).toBe(true);
  expect(data.latitude).toBeLessThan(0);
  const ids = groupFields(data).map((g) => g.id);
  expect(ids).toContain('lokasi');
  expect(ids).toContain('perangkat');
});

it('PNG tanpa EXIF tidak punya GPS atau perangkat', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const data = await readExif(png);
  expect(hasGps(data)).toBe(false);
  expect(data.Make).toBeUndefined();
  expect(groupFields(data).map((g) => g.id)).not.toContain('lokasi');
});
