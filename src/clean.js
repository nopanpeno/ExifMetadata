import { isJpeg, cleanAllJpeg, removeFieldsJpeg, listRemovable } from './jpeg.js';

export async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export function cleanName(name, ext) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-bersih.${ext}`;
}

// PNG, WebP: gambar ulang lewat canvas. Metadata hilang, kualitas WebP bisa turun.
async function canvasClean(file) {
  const type = file.type === 'image/webp' ? 'image/webp' : 'image/png';
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
  if (isJpeg(bytes)) {
    return {
      blob: new Blob([cleanAllJpeg(bytes, { keepOrientation })], { type: 'image/jpeg' }),
      ext: 'jpg',
      lossy: false,
    };
  }
  return canvasClean(file);
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
