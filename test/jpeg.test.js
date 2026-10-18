import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readExif } from '../src/exif-read.js';
import { hasGps } from '../src/exif-groups.js';
import {
  isJpeg, stripAllMetadata, cleanAllJpeg, removeFieldsJpeg, listRemovable, readOrientation,
} from '../src/jpeg.js';

const load = (n) => new Uint8Array(readFileSync(new URL(`./${n}`, import.meta.url)));
const sample = load('fixtures/sample.jpg');
const rot = load('fixtures/sample-rot.jpg');

function withSegment(u8, marker, payload) {
  const len = payload.length + 2;
  const seg = Uint8Array.from([0xff, marker, len >> 8, len & 255, ...payload]);
  const out = new Uint8Array(u8.length + seg.length);
  out.set(u8.subarray(0, 2));
  out.set(seg, 2);
  out.set(u8.subarray(2), 2 + seg.length);
  return out;
}
const enc = (s) => [...s].map((c) => c.charCodeAt(0));

describe('stripAllMetadata', () => {
  it('buang EXIF, GPS, XMP, komentar, IPTC', async () => {
    let dirty = withSegment(sample, 0xe1, [...enc('http://ns.adobe.com/xap/1.0/'), 0, ...enc('<x:xmpmeta/>')]);
    dirty = withSegment(dirty, 0xfe, enc('rahasia'));
    dirty = withSegment(dirty, 0xed, [...enc('Photoshop 3.0'), 0]);
    const clean = stripAllMetadata(dirty);
    expect(isJpeg(clean)).toBe(true);
    expect(clean.length).toBeLessThan(dirty.length);
    const data = await readExif(clean);
    expect(data.Make).toBeUndefined();
    expect(data.Model).toBeUndefined();
    expect(hasGps(data)).toBe(false);
    expect(Buffer.from(clean).includes('rahasia')).toBe(false);
    expect(Buffer.from(clean).includes('xmpmeta')).toBe(false);
  });
  it('akhir file tetap EOI, data setelah EOI dibuang', () => {
    const tail = new Uint8Array(sample.length + 5);
    tail.set(sample);
    tail.set(enc('EXTRA'), sample.length);
    const clean = stripAllMetadata(tail);
    expect([clean.at(-2), clean.at(-1)]).toEqual([0xff, 0xd9]);
    expect(Buffer.from(clean).includes('EXTRA')).toBe(false);
  });
  it('tolak non-JPEG', () => {
    expect(() => stripAllMetadata(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe('orientasi', () => {
  it('dipertahankan jika diminta', async () => {
    expect(readOrientation(rot)).toBe(6);
    const kept = cleanAllJpeg(rot, { keepOrientation: true });
    expect(readOrientation(kept)).toBe(6);
    const data = await readExif(kept);
    expect(data.Make).toBeUndefined();
  });
  it('hilang jika tidak diminta', () => {
    expect(readOrientation(cleanAllJpeg(rot, { keepOrientation: false }))).toBe(1);
  });
});

describe('removeFieldsJpeg', () => {
  it('listRemovable memuat nama field', () => {
    const names = listRemovable(sample);
    for (const n of ['Make', 'Model', 'GPSLatitude', 'latitude', 'longitude']) expect(names.has(n)).toBe(true);
  });
  it('buang Model saja', async () => {
    const out = removeFieldsJpeg(sample, ['Model']);
    const data = await readExif(out);
    expect(data.Model).toBeUndefined();
    expect(data.Make).toBe('TestMake');
    expect(hasGps(data)).toBe(true);
  });
  it('buang latitude menghapus lokasi', async () => {
    const data = await readExif(removeFieldsJpeg(sample, ['latitude']));
    expect(hasGps(data)).toBe(false);
    expect(data.Make).toBe('TestMake');
  });
});

describe('foto contoh tambahan', () => {
  const prog = load('fixtures/progressive-icc-gps.jpg');
  const noExif = load('fixtures/no-exif.jpg');
  const ser = load('fixtures/serial-owner.jpg');

  const indexOfSeq = (u8, a, b) => {
    for (let i = 0; i < u8.length - 1; i++) if (u8[i] === a && u8[i + 1] === b) return i;
    return -1;
  };
  const sofStart = (u8) => Math.max(indexOfSeq(u8, 0xff, 0xc0), indexOfSeq(u8, 0xff, 0xc2));

  it('progresif: data gambar sama persis, ICC tetap ada, GPS hilang', async () => {
    const before = await readExif(prog);
    expect(before.latitude).toBeLessThan(0); // selatan
    expect(before.longitude).toBeLessThan(0); // barat
    const out = stripAllMetadata(prog);
    expect(Buffer.from(out.subarray(sofStart(out))).equals(Buffer.from(prog.subarray(sofStart(prog))))).toBe(true);
    expect(Buffer.from(out).includes('ICC_PROFILE')).toBe(true);
    const after = await readExif(out);
    expect(hasGps(after)).toBe(false);
    expect(after.Make).toBeUndefined();
  });

  it('tanpa EXIF: aman diproses, hasil sama dengan masukan', () => {
    const out = stripAllMetadata(noExif);
    expect(Buffer.from(out).equals(Buffer.from(noExif))).toBe(true);
    expect(listRemovable(noExif).size).toBe(0);
  });

  it('nomor seri dan pemilik bisa dibuang selektif', async () => {
    const names = listRemovable(ser);
    expect(names.has('BodySerialNumber')).toBe(true);
    expect(names.has('CameraOwnerName')).toBe(true);
    const out = removeFieldsJpeg(ser, ['BodySerialNumber', 'CameraOwnerName']);
    const data = await readExif(out);
    expect(data.BodySerialNumber).toBeUndefined();
    expect(data.CameraOwnerName).toBeUndefined();
    expect(data.Make).toBe('SerMake');
  });

  it('hapus terpilih tanpa EXIF tidak error', () => {
    expect(() => removeFieldsJpeg(noExif, ['Model'])).not.toThrow();
  });
});
