import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripPng, crc32 } from '../src/png.js';
import { stripWebp } from '../src/webp.js';
import { cleanBytes } from '../src/clean.js';
import { scanStructure } from '../src/scan.js';
import { readTiffOrientation, makeOrientationTiff, isOrientationOnlyTiff } from '../src/orient.js';
import { enc } from './helpers.js';
import { readExif } from '../src/exif-read.js';
import { groupFields, hasGps } from '../src/exif-groups.js';

const load = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const ascii = (u, o, n) => String.fromCharCode(...u.subarray(o, o + n));
const eq = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const ids = (r) => r.found.map((f) => f.id);

function pngChunks(u8) {
  const out = [];
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let i = 8; i + 12 <= u8.length; ) {
    const len = dv.getUint32(i);
    out.push({ type: ascii(u8, i + 4, 4), data: u8.subarray(i + 8, i + 8 + len), raw: u8.subarray(i, i + 12 + len) });
    i += 12 + len;
  }
  return out;
}
const idat = (u8) => pngChunks(u8).filter((c) => c.type === 'IDAT').map((c) => Buffer.from(c.raw));

function webpChunks(u8) {
  const out = [];
  for (let i = 12; i + 8 <= u8.length; ) {
    const len = (u8[i + 4] | (u8[i + 5] << 8) | (u8[i + 6] << 16) | (u8[i + 7] << 24)) >>> 0;
    out.push({ type: ascii(u8, i, 4), data: u8.subarray(i + 8, i + 8 + len), raw: u8.subarray(i, i + 8 + len + (len & 1)) });
    i += 8 + len + (len & 1);
  }
  return out;
}

describe('orient', () => {
  it('tulis lalu baca orientasi', () => {
    for (const o of [2, 3, 6, 8]) {
      const t = makeOrientationTiff(o);
      expect(readTiffOrientation(t)).toBe(o);
      expect(isOrientationOnlyTiff(t)).toBe(true);
    }
  });
  it('TIFF lain bukan orientasi-saja', () => {
    expect(isOrientationOnlyTiff(new Uint8Array(30))).toBe(false);
    expect(readTiffOrientation(new Uint8Array(30))).toBe(1);
  });
});

describe('PNG', () => {
  const meta = load('meta.png');

  it('foto contoh memang berisi teks, eXIf, iCCP, XMP', () => {
    const types = pngChunks(meta).map((c) => c.type);
    for (const t of ['tEXt', 'iTXt', 'eXIf', 'iCCP']) expect(types).toContain(t);
  });

  it('metadata dibuang, data gambar (IDAT) sama persis', () => {
    const out = stripPng(meta, { keepOrientation: false });
    expect(pngChunks(out).map((c) => c.type).filter((t) => !['IHDR', 'IDAT', 'IEND'].includes(t))).toEqual(['iCCP']);
    expect(idat(out)).toEqual(idat(meta));
    expect(ids(scanStructure(out))).toEqual([]);
  });

  it('chunk yang disalin tidak berubah byte-nya (CRC tetap sah)', () => {
    const out = stripPng(meta, { keepOrientation: false });
    const orig = new Map(pngChunks(meta).map((c) => [c.type, Buffer.from(c.raw)]));
    for (const c of pngChunks(out)) if (c.type !== 'IDAT') expect(Buffer.from(c.raw).equals(orig.get(c.type))).toBe(true);
  });

  it('orientasi dipertahankan: hanya eXIf orientasi dengan CRC sah, GPS hilang', () => {
    const out = stripPng(meta, { keepOrientation: true });
    const ex = pngChunks(out).filter((c) => c.type === 'eXIf');
    expect(ex).toHaveLength(1);
    expect(readTiffOrientation(ex[0].data)).toBe(6);
    expect(isOrientationOnlyTiff(ex[0].data)).toBe(true);
    const raw = ex[0].raw;
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    expect(dv.getUint32(raw.length - 4)).toBe(crc32(raw.subarray(4, raw.length - 4)));
    expect(pngChunks(out)[1].type).toBe('eXIf'); // tepat setelah IHDR
    const r = scanStructure(out);
    expect(r.found).toEqual([]);
    expect(r.kept.map((k) => k.id)).toEqual(expect.arrayContaining(['icc', 'exif-orientation']));
  });

  it('PNG polos: hasil identik byte demi byte', () => {
    const plain = load('plain.png');
    expect(eq(stripPng(plain), plain)).toBe(true);
  });

  it('chunk tak dikenal, tIME, dan data setelah IEND dibuang', () => {
    const plain = load('plain.png');
    const chunks = pngChunks(plain);
    const mk = (type, data) => {
      const body = Uint8Array.from([...enc(type), ...data]);
      const len = data.length;
      const out = new Uint8Array(12 + len);
      new DataView(out.buffer).setUint32(0, len);
      out.set(body, 4);
      new DataView(out.buffer).setUint32(8 + len, crc32(body));
      return out;
    };
    const parts = [plain.subarray(0, 8), chunks[0].raw, mk('tIME', [7, 234, 1, 2, 3, 4, 5]), mk('prVt', enc('rahasia')), ...chunks.slice(1).map((c) => c.raw), Uint8Array.from(enc('EXTRA'))];
    const dirty = Uint8Array.from(parts.flatMap((p) => [...p]));
    expect(ids(scanStructure(dirty))).toEqual(expect.arrayContaining(['tIME', 'trailing']));
    const out = stripPng(dirty);
    expect(eq(out, plain)).toBe(true);
  });

  it('rusak: terpotong atau tanpa IEND melempar error', () => {
    expect(() => stripPng(meta.subarray(0, 60))).toThrow('rusak');
    expect(() => stripPng(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow();
  });
});

describe('WebP', () => {
  it('foto contoh memang berisi EXIF, XMP, ICCP', () => {
    const types = webpChunks(load('meta.webp')).map((c) => c.type);
    for (const t of ['EXIF', 'XMP ', 'ICCP', 'VP8X']) expect(types).toContain(t);
  });

  it('EXIF dan XMP dibuang, data gambar sama persis, bendera dan ukuran RIFF benar', () => {
    const src = load('meta.webp');
    const out = stripWebp(src, { keepOrientation: false });
    const types = webpChunks(out).map((c) => c.type);
    expect(types).not.toContain('EXIF');
    expect(types).not.toContain('XMP ');
    expect(types).toContain('ICCP');
    const img = (u) => webpChunks(u).filter((c) => c.type === 'VP8 ').map((c) => Buffer.from(c.raw));
    expect(img(out)).toEqual(img(src));
    const flags = webpChunks(out).find((c) => c.type === 'VP8X').data[0];
    expect(flags & 0x0c).toBe(0); // bit EXIF dan XMP mati
    expect(flags & 0x20).toBe(0x20); // bit ICC tetap
    const riff = (out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24)) >>> 0;
    expect(riff).toBe(out.length - 8);
    expect(ids(scanStructure(out))).toEqual([]);
  });

  it('orientasi dipertahankan: EXIF orientasi saja dan bendera menyala', () => {
    const out = stripWebp(load('alpha.webp'), { keepOrientation: true });
    const ex = webpChunks(out).filter((c) => c.type === 'EXIF');
    expect(ex).toHaveLength(1);
    expect(readTiffOrientation(ex[0].data)).toBe(6);
    expect(webpChunks(out).find((c) => c.type === 'VP8X').data[0] & 0x08).toBe(0x08);
    const r = scanStructure(out);
    expect(r.found).toEqual([]);
    expect(r.kept.map((k) => k.id)).toContain('exif-orientation');
    const riff = (out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24)) >>> 0;
    expect(riff).toBe(out.length - 8);
  });

  it('animasi: semua frame (ANMF) dan ANIM tetap utuh', () => {
    const src = load('anim.webp');
    const out = stripWebp(src, { keepOrientation: false });
    const pick = (u, t) => webpChunks(u).filter((c) => c.type === t).map((c) => Buffer.from(c.raw));
    expect(pick(out, 'ANMF').length).toBe(3);
    expect(pick(out, 'ANMF')).toEqual(pick(src, 'ANMF'));
    expect(pick(out, 'ANIM')).toEqual(pick(src, 'ANIM'));
    expect(webpChunks(out).some((c) => c.type === 'EXIF')).toBe(false);
  });

  it('WebP sederhana tanpa metadata: identik', () => {
    const simple = (() => {
      const vp8 = [...enc('VP8 '), 4, 0, 0, 0, 1, 2, 3, 4];
      const body = [...enc('WEBP'), ...vp8];
      return Uint8Array.from([...enc('RIFF'), body.length, 0, 0, 0, ...body]);
    })();
    expect(eq(stripWebp(simple), simple)).toBe(true);
  });

  it('rusak melempar error', () => {
    expect(() => stripWebp(load('meta.webp').subarray(0, 30))).toThrow('rusak');
    expect(() => stripWebp(new Uint8Array(20))).toThrow();
  });
});

describe('cleanBytes memilih jalur dari signature', () => {
  it('JPEG, PNG, WebP', () => {
    expect(cleanBytes(load('sample.jpg')).ext).toBe('jpg');
    expect(cleanBytes(load('meta.png')).ext).toBe('png');
    expect(cleanBytes(load('meta.webp')).ext).toBe('webp');
  });
  it('format lain ditolak', () => {
    expect(() => cleanBytes(new Uint8Array(30))).toThrow('belum didukung');
  });
});

describe('baca metadata WebP (exifr tidak mendukung WebP)', () => {
  it('EXIF terbaca, GPS terdeteksi, XMP ditampilkan sebagai data', async () => {
    const data = await readExif(load('meta.webp'));
    expect(data.Make).toBe('PngMake');
    expect(hasGps(data)).toBe(true);
    expect(data.XMP).toBeInstanceOf(Uint8Array);
    const fields = groupFields(data).flatMap((g) => g.fields);
    expect(fields.find((f) => f.key === 'XMP').value).toMatch(/\[data biner \d+ byte\]/);
  });
  it('WebP animasi dan lossless-alpha juga terbaca', async () => {
    for (const n of ['alpha.webp', 'anim.webp']) expect((await readExif(load(n))).Make).toBe('PngMake');
  });
  it('WebP tanpa metadata: objek kosong; Blob juga diterima', async () => {
    const clean = stripWebp(load('meta.webp'), { keepOrientation: false });
    expect(await readExif(clean)).toEqual({});
    const blob = new Blob([load('meta.webp')]);
    expect((await readExif(blob)).Make).toBe('PngMake');
  });
  it('WebP orientasi-saja: hanya Orientation terbaca', async () => {
    const data = await readExif(stripWebp(load('alpha.webp'), { keepOrientation: true }));
    expect(Object.keys(data)).toEqual(['Orientation']);
  });
});
