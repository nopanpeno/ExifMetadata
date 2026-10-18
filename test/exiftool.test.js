// Pembanding independen: ExifTool (lewat exiftool-vendored, Perl) membaca file hasil.
// Metrik PRD: "foto bersih menurut ExifTool = 100% pada set uji".
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exiftool } from 'exiftool-vendored';
import piexif from 'piexifjs';
import { cleanAllJpeg, removeFieldsJpeg } from '../src/jpeg.js';
import { scanStructure } from '../src/scan.js';
import { dirty } from './helpers.js';

const dir = mkdtempSync(join(tmpdir(), 'exif-'));
afterAll(async () => {
  await exiftool.end();
  rmSync(dir, { recursive: true, force: true });
});

const fixtureDir = new URL('./fixtures/', import.meta.url);
const jpegs = readdirSync(fixtureDir).filter((n) => n.endsWith('.jpg'));

let n = 0;
async function inspect(bytes) {
  const file = join(dir, `t${n++}.jpg`);
  writeFileSync(file, bytes);
  const tags = await exiftool.readRaw(file, ['-a', '-G1', '-s']);
  const names = Object.keys(tags).filter((k) => !['SourceFile', 'errors', 'warnings'].includes(k));
  return { tags, names, groups: new Set(names.map((k) => k.split(':')[0])), problems: [...(tags.errors ?? []), ...(tags.warnings ?? [])] };
}

// Grup yang boleh ada pada hasil bersih: info berkas, bukan metadata foto.
// MWG hanya tampilan gabungan dari tag yang ada; bila tag aslinya hilang, ia ikut hilang.
const OK_GROUPS = new Set(['ExifTool', 'System', 'File', 'JFIF', 'Composite', 'MWG']);
const isOkGroup = (k) => OK_GROUPS.has(k.split(':')[0]) || k.startsWith('ICC');
const bad = (names) => names.filter((k) => !isOkGroup(k) || /:Comment$/.test(k));

describe('ExifTool membaca hasil Hapus semua', () => {
  for (const name of jpegs) {
    it(`${name}: bersih, juga setelah disisipi XMP, IPTC, komentar, data tambahan`, async () => {
      const src = new Uint8Array(readFileSync(new URL(name, fixtureDir)));
      const before = await inspect(dirty(src));
      // Pastikan data uji memang kotor menurut ExifTool, jadi tes ini bermakna.
      expect(before.groups.has('XMP-dc')).toBe(true);
      expect(before.groups.has('IPTC')).toBe(true);
      expect(before.names.some((k) => /:Comment$/.test(k))).toBe(true);

      const after = await inspect(cleanAllJpeg(dirty(src), { keepOrientation: false }));
      expect(bad(after.names)).toEqual([]);
      expect(after.problems).toEqual([]);
    });
  }

  it('keepOrientation: hanya Orientation yang tersisa', async () => {
    const src = new Uint8Array(readFileSync(new URL('sample-rot.jpg', fixtureDir)));
    const after = await inspect(cleanAllJpeg(dirty(src), { keepOrientation: true }));
    expect(after.names.filter((k) => !isOkGroup(k))).toEqual(['IFD0:Orientation']);
    expect(after.tags['IFD0:Orientation']).toBe('Rotate 90 CW');
    expect(after.problems).toEqual([]);
  });
});

describe('ExifTool membaca hasil Hapus terpilih', () => {
  const sample = new Uint8Array(readFileSync(new URL('sample.jpg', fixtureDir)));

  it('buang Model saja: Make dan GPS tetap', async () => {
    const r = await inspect(removeFieldsJpeg(sample, ['Model']));
    expect(r.names).not.toContain('IFD0:Model');
    expect(r.names).toContain('IFD0:Make');
    expect(r.groups.has('GPS')).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('buang latitude: koordinat hilang di semua grup', async () => {
    const r = await inspect(removeFieldsJpeg(sample, ['latitude']));
    expect(r.names.filter((k) => /GPSLatitude|GPSLongitude|GPSPosition/.test(k))).toEqual([]);
    expect(r.names).toContain('IFD0:Make');
  });

  it('buang ISO (nama exifr) menghapus tag ISO asli', async () => {
    const r = await inspect(removeFieldsJpeg(sample, ['ISO']));
    expect(r.names).not.toContain('ExifIFD:ISO');
  });

  it('thumbnail tertanam ikut dibuang', async () => {
    const toBin = (u) => Buffer.from(u).toString('latin1');
    const thumb = toBin(readFileSync(new URL('no-exif.jpg', fixtureDir)));
    const ex = piexif.load(toBin(sample));
    ex['1st'] = { [piexif.ImageIFD.Orientation]: 1 };
    ex.thumbnail = thumb;
    const withThumb = Uint8Array.from(Buffer.from(piexif.insert(piexif.dump(ex), toBin(sample)), 'latin1'));
    const before = await inspect(withThumb);
    expect(before.groups.has('IFD1')).toBe(true); // data uji memang punya thumbnail
    const after = await inspect(removeFieldsJpeg(withThumb, ['Model']));
    expect(after.groups.has('IFD1')).toBe(false);
    expect(after.names.some((k) => /Thumbnail/.test(k))).toBe(false);
    expect(after.names).toContain('IFD0:Make');
  });

  it('XMP dan IPTC tidak tersentuh, dan pemindai setuju dengan ExifTool', async () => {
    const out = removeFieldsJpeg(dirty(sample), ['Make']);
    const r = await inspect(out);
    expect(r.groups.has('XMP-dc')).toBe(true);
    expect(r.groups.has('IPTC')).toBe(true);
    const ids = scanStructure(out).found.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['xmp', 'iptc', 'comment']));
  });
});

describe('pemindai vs ExifTool pada hasil Hapus semua', () => {
  it('pemindai kosong jika dan hanya jika ExifTool tidak menemukan metadata', async () => {
    for (const name of jpegs) {
      const src = new Uint8Array(readFileSync(new URL(name, fixtureDir)));
      const out = cleanAllJpeg(dirty(src), { keepOrientation: false });
      expect(scanStructure(out).found).toEqual([]);
      expect(bad((await inspect(out)).names)).toEqual([]);
    }
  });
});
