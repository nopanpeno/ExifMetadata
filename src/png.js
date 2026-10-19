// Bersihkan PNG tanpa gambar ulang: salin hanya chunk yang dibutuhkan untuk menampilkan gambar.
import { readTiffOrientation, makeOrientationTiff } from './orient.js';

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Daftar putih: chunk yang memengaruhi tampilan gambar. Selain ini dibuang
// (teks, eXIf, tIME, chunk tak dikenal yang bisa memuat apa saja).
const KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs',
  'cICP', 'mDCV', 'cLLI', 'acTL', 'fcTL', 'fdAT',
]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(u8) {
  return u8.length >= 8 && SIG.every((b, i) => u8[i] === b);
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function stripPng(u8, { keepOrientation = true } = {}) {
  if (!isPng(u8)) throw new Error('Bukan PNG');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const kept = [];
  let orientation = 1;
  let i = 8;
  let ended = false;
  while (i + 12 <= u8.length) {
    const len = dv.getUint32(i);
    const end = i + 12 + len;
    if (end > u8.length) throw new Error('Struktur PNG rusak');
    const type = String.fromCharCode(...u8.subarray(i + 4, i + 8));
    if (type === 'eXIf' && keepOrientation) orientation = readTiffOrientation(u8.subarray(i + 8, i + 8 + len));
    if (KEEP.has(type)) kept.push(u8.subarray(i, end));
    i = end;
    if (type === 'IEND') {
      ended = true; // data setelah IEND dibuang
      break;
    }
  }
  if (!ended || kept.length === 0 || String.fromCharCode(...kept[0].subarray(4, 8)) !== 'IHDR') {
    throw new Error('Struktur PNG rusak');
  }
  // eXIf berisi orientasi saja, diletakkan tepat setelah IHDR.
  if (orientation !== 1) kept.splice(1, 0, chunk('eXIf', makeOrientationTiff(orientation)));
  return concat([Uint8Array.from(SIG), ...kept]);
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
