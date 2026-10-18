import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanStructure } from '../src/scan.js';
import { cleanAllJpeg, removeFieldsJpeg } from '../src/jpeg.js';

const load = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const enc = (s) => [...s].map((c) => c.charCodeAt(0));
const ids = (r) => r.found.map((f) => f.id);

function withSegment(u8, marker, payload) {
  const len = payload.length + 2;
  const seg = Uint8Array.from([0xff, marker, len >> 8, len & 255, ...payload]);
  const out = new Uint8Array(u8.length + seg.length);
  out.set(u8.subarray(0, 2));
  out.set(seg, 2);
  out.set(u8.subarray(2), 2 + seg.length);
  return out;
}

describe('scan JPEG', () => {
  it('foto mentah: EXIF terdeteksi', () => {
    const r = scanStructure(load('sample.jpg'));
    expect(r.format).toBe('jpeg');
    expect(ids(r)).toContain('exif');
  });
  it('setelah hapus semua: tidak ada yang tersisa', () => {
    const r = scanStructure(cleanAllJpeg(load('sample.jpg')));
    expect(r.found).toEqual([]);
    expect(r.error).toBeUndefined();
  });
  it('orientasi dipertahankan dicatat sebagai kept, bukan found', () => {
    const r = scanStructure(cleanAllJpeg(load('sample-rot.jpg'), { keepOrientation: true }));
    expect(r.found).toEqual([]);
    expect(r.kept.map((k) => k.id)).toContain('exif-orientation');
  });
  it('tanpa jaga orientasi: tidak ada EXIF sama sekali', () => {
    const r = scanStructure(cleanAllJpeg(load('sample-rot.jpg'), { keepOrientation: false }));
    expect(r.found).toEqual([]);
    expect(r.kept).toEqual([]);
  });
  it('ICC tercatat kept', () => {
    const r = scanStructure(cleanAllJpeg(load('progressive-icc-gps.jpg')));
    expect(r.found).toEqual([]);
    expect(r.kept.map((k) => k.id)).toContain('icc');
  });
  it('XMP, IPTC, komentar, MPF, data setelah EOI terdeteksi', () => {
    let u = load('no-exif.jpg');
    u = withSegment(u, 0xe1, [...enc('http://ns.adobe.com/xap/1.0/'), 0, ...enc('<x/>')]);
    u = withSegment(u, 0xed, [...enc('Photoshop 3.0'), 0]);
    u = withSegment(u, 0xfe, enc('hi'));
    u = withSegment(u, 0xe2, [...enc('MPF'), 0, 1, 2]);
    const tail = new Uint8Array(u.length + 4);
    tail.set(u);
    tail.set(enc('EXTRA').slice(0, 4), u.length);
    const r = scanStructure(tail);
    for (const id of ['xmp', 'iptc', 'comment', 'mpf', 'trailing']) expect(ids(r)).toContain(id);
  });
  it('hapus terpilih: EXIF sisa tetap terdeteksi', () => {
    const r = scanStructure(removeFieldsJpeg(load('sample.jpg'), ['Model']));
    expect(ids(r)).toContain('exif');
  });
  it('file terpotong ditandai error, tidak melempar', () => {
    const u = load('sample.jpg');
    expect(scanStructure(u.subarray(0, 40)).error).toBe(true);
  });
});

// ---- PNG dan WebP sintetis ----
function pngChunk(type, data = []) {
  const len = data.length;
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...enc(type), ...data, 0, 0, 0, 0];
}
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
const IDAT = pngChunk('IDAT', [1, 2, 3]);
const IEND = pngChunk('IEND');

describe('scan PNG', () => {
  it('bersih', () => {
    const r = scanStructure(Uint8Array.from([...PNG_SIG, ...IHDR, ...IDAT, ...IEND]));
    expect(r.found).toEqual([]);
  });
  it('tEXt, iTXt, eXIf, tIME terdeteksi, iCCP kept', () => {
    const u = Uint8Array.from([
      ...PNG_SIG, ...IHDR, ...pngChunk('iCCP', [1]), ...pngChunk('tEXt', enc('a\0b')),
      ...pngChunk('iTXt', [1]), ...pngChunk('eXIf', [1]), ...pngChunk('tIME', [0, 0, 0, 0, 0, 0, 0]),
      ...IDAT, ...IEND, 9, 9,
    ]);
    const r = scanStructure(u);
    expect(ids(r)).toEqual(['tEXt', 'iTXt', 'eXIf', 'tIME', 'trailing']);
    expect(r.kept.map((k) => k.id)).toEqual(['icc']);
  });
  it('terpotong ditandai error', () => {
    expect(scanStructure(Uint8Array.from([...PNG_SIG, ...IHDR, 0, 0, 1, 0, ...enc('IDAT')])).error).toBe(true);
  });
});

function webpChunk(type, data) {
  const n = data.length;
  const pad = n & 1 ? [0] : [];
  return [...enc(type), n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255, ...data, ...pad];
}
function webp(...chunks) {
  const body = [...enc('WEBP'), ...chunks.flat()];
  const n = body.length;
  return Uint8Array.from([...enc('RIFF'), n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255, ...body]);
}

describe('scan WebP', () => {
  it('bersih', () => {
    expect(scanStructure(webp(webpChunk('VP8 ', [1, 2, 3, 4]))).found).toEqual([]);
  });
  it('EXIF dan XMP terdeteksi, ICCP kept', () => {
    const r = scanStructure(webp(webpChunk('VP8X', new Array(10).fill(0)), webpChunk('ICCP', [1]), webpChunk('EXIF', [1, 2, 3]), webpChunk('XMP ', [1, 2]), webpChunk('VP8 ', [1, 2])));
    expect(ids(r)).toEqual(['EXIF', 'XMP']);
    expect(r.kept.map((k) => k.id)).toEqual(['icc']);
  });
});

it('format tak dikenal', () => {
  const r = scanStructure(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  expect(r.format).toBe(null);
  expect(r.error).toBe(true);
});
