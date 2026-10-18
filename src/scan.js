// Pindai struktur file: segmen JPEG, chunk PNG, chunk WebP.
// Bukan pembaca EXIF: yang dicari adalah wadah metadata, apa pun isinya.
// Hasil: { format, found: [...], kept: [...], error? }
//   found = wadah metadata yang masih ada (perlu perhatian)
//   kept  = bagian yang sengaja dipertahankan dan tidak berisiko (ICC, orientasi)
import { exifIsOrientationOnly } from './jpeg.js';

const ascii = (u8, start, len) => String.fromCharCode(...u8.subarray(start, start + len));
const startsWith = (u8, at, text) => ascii(u8, at, text.length) === text;

function add(list, id, label, bytes) {
  list.push({ id, label, bytes });
}

export function scanJpeg(u8) {
  const found = [];
  const kept = [];
  let i = 2;
  let exifSeen = false;
  while (i < u8.length - 1) {
    if (u8[i] !== 0xff) return { format: 'jpeg', found, kept, error: true };
    while (u8[i + 1] === 0xff) i++;
    const marker = u8[i + 1];
    if (marker === 0xd9) {
      const trailing = u8.length - (i + 2);
      if (trailing > 0) add(found, 'trailing', 'Data tambahan setelah akhir gambar', trailing);
      return { format: 'jpeg', found, kept };
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (u8[i + 2] << 8) | u8[i + 3];
    const end = i + 2 + len;
    if (len < 2 || end > u8.length) return { format: 'jpeg', found, kept, error: true };
    const d = i + 4; // awal isi segmen
    const size = len - 2;
    if (marker === 0xe1) {
      if (startsWith(u8, d, 'Exif\0\0')) {
        if (!exifSeen && exifIsOrientationOnly(u8)) add(kept, 'exif-orientation', 'EXIF kosong atau hanya berisi orientasi foto', size);
        else add(found, 'exif', 'EXIF', size);
        exifSeen = true;
      } else if (startsWith(u8, d, 'http://ns.adobe.com/xap/1.0/')) add(found, 'xmp', 'XMP', size);
      else if (startsWith(u8, d, 'http://ns.adobe.com/xmp/extension/')) add(found, 'xmp', 'XMP (lanjutan)', size);
      else add(found, 'app1', 'Segmen APP1 tak dikenal', size);
    } else if (marker === 0xe2) {
      if (startsWith(u8, d, 'ICC_PROFILE\0')) add(kept, 'icc', 'Profil warna ICC', size);
      else if (startsWith(u8, d, 'MPF\0')) add(found, 'mpf', 'Multi-Picture (bisa memuat gambar kedua)', size);
      else add(found, 'app2', 'Segmen APP2 tak dikenal', size);
    } else if (marker === 0xed) {
      add(found, 'iptc', 'IPTC / Photoshop', size);
    } else if (marker === 0xfe) {
      add(found, 'comment', 'Komentar', size);
    } else if (marker === 0xe0) {
      if (startsWith(u8, d, 'JFXX')) add(found, 'jfxx', 'Thumbnail JFXX', size);
    } else if (marker === 0xee) {
      if (!startsWith(u8, d, 'Adobe')) add(found, 'app14', 'Segmen APP14 tak dikenal', size);
    } else if (marker >= 0xe3 && marker <= 0xef) {
      add(found, `app${marker - 0xe0}`, `Segmen APP${marker - 0xe0}`, size);
    }
    if (marker === 0xda) {
      // lewati data entropi sampai penanda nyata berikutnya
      let j = end;
      while (j < u8.length - 1) {
        if (u8[j] === 0xff && u8[j + 1] !== 0x00 && u8[j + 1] !== 0xff && !(u8[j + 1] >= 0xd0 && u8[j + 1] <= 0xd7)) break;
        j++;
      }
      i = j;
      continue;
    }
    i = end;
  }
  return { format: 'jpeg', found, kept, error: true }; // tidak ada EOI
}

const PNG_TEXT = { tEXt: 'Teks', zTXt: 'Teks terkompresi', iTXt: 'Teks (bisa memuat XMP)' };

export function scanPng(u8) {
  const found = [];
  const kept = [];
  let i = 8;
  while (i + 8 <= u8.length) {
    const len = ((u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3]) >>> 0;
    const type = ascii(u8, i + 4, 4);
    const next = i + 12 + len;
    if (next > u8.length) return { format: 'png', found, kept, error: true };
    if (PNG_TEXT[type]) add(found, type, `${PNG_TEXT[type]} (${type})`, len);
    else if (type === 'eXIf') add(found, 'eXIf', 'EXIF (eXIf)', len);
    else if (type === 'tIME') add(found, 'tIME', 'Waktu modifikasi (tIME)', len);
    else if (type === 'iCCP') add(kept, 'icc', 'Profil warna ICC', len);
    if (type === 'IEND') {
      if (u8.length > next) add(found, 'trailing', 'Data tambahan setelah akhir gambar', u8.length - next);
      return { format: 'png', found, kept };
    }
    i = next;
  }
  return { format: 'png', found, kept, error: true }; // tidak ada IEND
}

const WEBP_FOUND = { EXIF: 'EXIF', 'XMP ': 'XMP' };

export function scanWebp(u8) {
  const found = [];
  const kept = [];
  const riffEnd = Math.min(u8.length, 8 + (u8[4] | (u8[5] << 8) | (u8[6] << 16) | (u8[7] << 24)));
  let i = 12;
  while (i + 8 <= riffEnd) {
    const type = ascii(u8, i, 4);
    const len = (u8[i + 4] | (u8[i + 5] << 8) | (u8[i + 6] << 16) | (u8[i + 7] << 24)) >>> 0;
    if (WEBP_FOUND[type]) add(found, type.trim(), `${WEBP_FOUND[type]} (${type.trim()})`, len);
    else if (type === 'ICCP') add(kept, 'icc', 'Profil warna ICC', len);
    i += 8 + len + (len & 1);
  }
  if (i > riffEnd + 1) return { format: 'webp', found, kept, error: true };
  if (u8.length > riffEnd + (riffEnd & 1)) add(found, 'trailing', 'Data tambahan setelah akhir gambar', u8.length - riffEnd);
  return { format: 'webp', found, kept };
}

// Pilih pemindai dari signature file.
export function scanStructure(u8) {
  if (u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8) return scanJpeg(u8);
  if (u8.length >= 8 && u8[0] === 0x89 && ascii(u8, 1, 3) === 'PNG') return scanPng(u8);
  if (u8.length >= 12 && ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') return scanWebp(u8);
  return { format: null, found: [], kept: [], error: true };
}
