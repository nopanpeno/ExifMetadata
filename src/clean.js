import { isJpeg, cleanAllJpeg, removeFieldsJpeg, listRemovable } from './jpeg.js';
import { stripPng } from './png.js';
import { stripWebp } from './webp.js';

export async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export function cleanName(name, ext) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-bersih.${ext}`;
}

function formatFromBytes(bytes) {
  if (isJpeg(bytes)) return 'jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

// Kenali format dari signature file agar MIME/ekstensi yang keliru tidak
// membuat format yang belum didukung masuk ke jalur pembersihan.
export async function detectFormat(file) {
  return formatFromBytes(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
}

// Inti sinkron (bisa dites di Node): hapus semua metadata tanpa mengubah piksel.
export function cleanBytes(bytes, { keepOrientation = true } = {}) {
  const format = formatFromBytes(bytes.subarray(0, 12));
  if (format === 'jpeg') return { bytes: cleanAllJpeg(bytes, { keepOrientation }), ext: 'jpg', mime: 'image/jpeg' };
  if (format === 'png') return { bytes: stripPng(bytes, { keepOrientation }), ext: 'png', mime: 'image/png' };
  if (format === 'webp') return { bytes: stripWebp(bytes, { keepOrientation }), ext: 'webp', mime: 'image/webp' };
  throw new Error('Format belum didukung. Pilih JPEG, PNG, atau WebP.');
}

// Hapus semua metadata. Hasil: { blob, ext, lossy: false } (selalu tanpa gambar ulang).
export async function cleanAll(file, opts = {}) {
  const r = cleanBytes(await fileBytes(file), opts);
  return { blob: new Blob([r.bytes], { type: r.mime }), ext: r.ext, lossy: false };
}

// Hapus field terpilih (JPEG saja).
export async function cleanSelected(file, keys) {
  const bytes = await fileBytes(file);
  if (!isJpeg(bytes)) throw new Error('Hapus terpilih hanya untuk JPEG. Pakai Hapus semua.');
  return {
    blob: new Blob([removeFieldsJpeg(bytes, keys)], { type: 'image/jpeg' }),
    ext: 'jpg',
    lossy: false,
  };
}

export async function removableKeys(file) {
  return listRemovable(await fileBytes(file));
}
