// Bersihkan WebP tanpa gambar ulang: buang chunk EXIF dan XMP serta chunk tak dikenal.
import { readTiffOrientation, makeOrientationTiff } from './orient.js';

const KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
const FLAG_EXIF = 0x08;
const FLAG_XMP = 0x04;

const tag = (u8, o) => String.fromCharCode(...u8.subarray(o, o + 4));
const u32le = (u8, o) => (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0;

export function isWebp(u8) {
  return u8.length >= 12 && tag(u8, 0) === 'RIFF' && tag(u8, 8) === 'WEBP';
}

function chunk(type, data) {
  const pad = data.length & 1;
  const out = new Uint8Array(8 + data.length + pad);
  for (let i = 0; i < 4; i++) out[i] = type.charCodeAt(i);
  out[4] = data.length & 255;
  out[5] = (data.length >> 8) & 255;
  out[6] = (data.length >> 16) & 255;
  out[7] = (data.length >>> 24) & 255;
  out.set(data, 8);
  return out;
}

export function stripWebp(u8, { keepOrientation = true } = {}) {
  if (!isWebp(u8)) throw new Error('Bukan WebP');
  const riffEnd = 8 + u32le(u8, 4);
  if (riffEnd > u8.length) throw new Error('Struktur WebP rusak'); // terpotong
  const kept = [];
  let orientation = 1;
  let vp8x = -1; // indeks chunk VP8X di kept
  let i = 12;
  while (i + 8 <= riffEnd) {
    const type = tag(u8, i);
    const len = u32le(u8, i + 4);
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > riffEnd) throw new Error('Struktur WebP rusak');
    if (type === 'EXIF' && keepOrientation) orientation = readTiffOrientation(u8.subarray(i + 8, i + 8 + len));
    if (KEEP.has(type)) {
      kept.push(u8.slice(i, Math.min(end, riffEnd)));
      if (type === 'VP8X') vp8x = kept.length - 1;
    }
    i = end;
  }
  if (!kept.some((c) => ['VP8 ', 'VP8L', 'ANMF'].includes(String.fromCharCode(...c.subarray(0, 4))))) {
    throw new Error('Struktur WebP rusak'); // tanpa data gambar
  }
  // Bendera VP8X: buang EXIF dan XMP; nyalakan EXIF lagi hanya jika orientasi ditulis ulang.
  if (vp8x >= 0) {
    kept[vp8x][8] &= ~(FLAG_EXIF | FLAG_XMP);
    if (orientation !== 1) {
      kept[vp8x][8] |= FLAG_EXIF;
      kept.push(chunk('EXIF', makeOrientationTiff(orientation)));
    }
  }
  const body = kept.reduce((n, p) => n + p.length, 4);
  const out = new Uint8Array(8 + body);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  out[4] = body & 255;
  out[5] = (body >> 8) & 255;
  out[6] = (body >> 16) & 255;
  out[7] = (body >>> 24) & 255;
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  let o = 12;
  for (const p of kept) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Ambil blok EXIF dan XMP mentah dari WebP (exifr tidak membaca WebP sendiri).
export function webpMetadata(u8) {
  const res = { exif: null, xmp: null };
  if (!isWebp(u8)) return res;
  const riffEnd = Math.min(u8.length, 8 + u32le(u8, 4));
  let i = 12;
  while (i + 8 <= riffEnd) {
    const type = tag(u8, i);
    const len = u32le(u8, i + 4);
    const data = u8.subarray(i + 8, Math.min(i + 8 + len, riffEnd));
    if (type === 'EXIF' && !res.exif) {
      // beberapa encoder menambah awalan "Exif\0\0"
      res.exif = data.length > 6 && tag(data, 0) === 'Exif' ? data.subarray(6) : data;
    } else if (type === 'XMP ' && !res.xmp) res.xmp = data;
    i += 8 + len + (len & 1);
  }
  return res;
}
