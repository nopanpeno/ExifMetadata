import { isJpeg, cleanAllJpeg, removeFieldsJpeg, listRemovable } from './jpeg.js';

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
// membuat format yang belum didukung masuk ke jalur pembersihan canvas.
export async function detectFormat(file) {
  return formatFromBytes(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
}

// PNG, WebP: gambar ulang lewat canvas. Metadata hilang, kualitas WebP bisa turun.
async function canvasClean(file, format) {
  const type = format === 'webp' ? 'image/webp' : 'image/png';
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('Browser tidak bisa membuka format ini. Coba JPEG, PNG, atau WebP.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, type, 1));
  if (!blob) throw new Error('Gagal membuat file baru.');
  return { blob, ext: type === 'image/webp' ? 'webp' : 'png', lossy: type === 'image/webp', redrawn: true };
}

// Hapus semua metadata. Hasil: { blob, ext, lossy }
export async function cleanAll(file, { keepOrientation = true } = {}) {
  const bytes = await fileBytes(file);
  const format = formatFromBytes(bytes.subarray(0, 12));
  if (format === 'jpeg') {
    return {
      blob: new Blob([cleanAllJpeg(bytes, { keepOrientation })], { type: 'image/jpeg' }),
      ext: 'jpg',
      lossy: false,
    };
  }
  if (!format) throw new Error('Format belum didukung. Pilih JPEG, PNG, atau WebP.');
  return canvasClean(file, format);
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
