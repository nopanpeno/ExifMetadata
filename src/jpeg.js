// Operasi JPEG tanpa gambar ulang: piksel tidak berubah.
import piexif from 'piexifjs';

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

export function isJpeg(u8) {
  return u8.length > 3 && u8[0] === 0xff && u8[1] === SOI;
}

function toBin(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return s;
}

function toBytes(bin) {
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

const ICC = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]; // "ICC_PROFILE\0"

function isIcc(u8, start) {
  return ICC.every((b, i) => u8[start + i] === b);
}

// Segmen yang dibuang: APP1 (EXIF, XMP), APP3-APP13 (IPTC, dll), COM.
// Segmen APP2 dibuang kecuali profil warna ICC. APP0, APP14 (Adobe) dipertahankan.
function dropSegment(marker, u8, dataStart) {
  if (marker === 0xe1 || marker === 0xfe) return true;
  if (marker >= 0xe3 && marker <= 0xed) return true;
  if (marker === 0xe2) return !isIcc(u8, dataStart);
  return false;
}

// Hapus semua metadata. Data setelah EOI pertama ikut dibuang
// (bisa memuat gambar tertanam atau video foto bergerak).
export function stripAllMetadata(u8) {
  if (!isJpeg(u8)) throw new Error('Bukan JPEG');
  const out = [u8.subarray(0, 2)];
  let i = 2;
  while (i < u8.length) {
    if (u8[i] !== 0xff) throw new Error('Struktur JPEG rusak');
    while (u8[i + 1] === 0xff) i++; // padding
    const marker = u8[i + 1];
    if (marker === EOI) {
      out.push(u8.subarray(i, i + 2));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(u8.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (u8[i + 2] << 8) | u8[i + 3];
    const end = i + 2 + len;
    if (len < 2 || end > u8.length) throw new Error('Struktur JPEG rusak');
    if (marker === SOS) {
      // header SOS + data entropi sampai penanda berikutnya yang nyata
      let j = end;
      while (j < u8.length - 1) {
        if (u8[j] === 0xff && u8[j + 1] !== 0x00 && !(u8[j + 1] >= 0xd0 && u8[j + 1] <= 0xd7) && u8[j + 1] !== 0xff) break;
        j++;
      }
      out.push(u8.subarray(i, j));
      i = j;
      continue;
    }
    if (!dropSegment(marker, u8, i + 4)) out.push(u8.subarray(i, end));
    i = end;
  }
  const size = out.reduce((n, p) => n + p.length, 0);
  const res = new Uint8Array(size);
  let o = 0;
  for (const p of out) {
    res.set(p, o);
    o += p.length;
  }
  return res;
}

export function readOrientation(u8) {
  try {
    const ex = piexif.load(toBin(u8));
    const o = ex['0th'][piexif.ImageIFD.Orientation];
    return Number.isInteger(o) && o >= 1 && o <= 8 ? o : 1;
  } catch {
    return 1;
  }
}

// Hapus semua, lalu (opsional) tulis ulang hanya Orientation
// supaya foto tidak tampak miring.
export function cleanAllJpeg(u8, { keepOrientation = true } = {}) {
  const orientation = keepOrientation ? readOrientation(u8) : 1;
  const stripped = stripAllMetadata(u8);
  if (orientation === 1) return stripped;
  const exifBin = piexif.dump({ '0th': { [piexif.ImageIFD.Orientation]: orientation }, Exif: {}, GPS: {} });
  return toBytes(piexif.insert(exifBin, toBin(stripped)));
}

const IFDS = ['0th', 'Exif', 'GPS', 'Interop'];
const LATLON = new Set(['GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef']);

// Nama exifr (tampil di UI) -> nama piexifjs (tag di file) bila berbeda.
const ALIAS = {
  ISO: 'ISOSpeedRatings',
  ExifImageWidth: 'PixelXDimension',
  ExifImageHeight: 'PixelYDimension',
  ModifyDate: 'DateTime',
  CreateDate: 'DateTimeDigitized',
  ExposureCompensation: 'ExposureBiasValue',
};

function nameOf(ifd, id) {
  return piexif.TAGS[ifd]?.[id]?.name;
}

// Nama field EXIF yang bisa dibuang satu per satu (+ latitude/longitude turunan).
export function listRemovable(u8) {
  const names = new Set();
  if (!isJpeg(u8)) return names;
  try {
    const ex = piexif.load(toBin(u8));
    for (const ifd of IFDS) {
      for (const id of Object.keys(ex[ifd] || {})) {
        const n = nameOf(ifd, Number(id));
        if (n) names.add(n);
      }
    }
    for (const [shown, tag] of Object.entries(ALIAS)) if (names.has(tag)) names.add(shown);
    if ([...LATLON].some((n) => names.has(n))) {
      names.add('latitude');
      names.add('longitude');
    }
  } catch {
    /* EXIF rusak: tidak ada yang bisa dibuang selektif */
  }
  return names;
}

// Buang field terpilih. Thumbnail selalu dibuang (bisa memuat gambar asli
// tanpa crop). XMP dan IPTC tidak disentuh; hanya "hapus semua" yang membuangnya.
export function removeFieldsJpeg(u8, keys) {
  if (!isJpeg(u8)) throw new Error('Bukan JPEG');
  const sel = new Set(keys);
  if (sel.has('latitude') || sel.has('longitude')) LATLON.forEach((n) => sel.add(n));
  for (const [shown, tag] of Object.entries(ALIAS)) if (sel.has(shown)) sel.add(tag);
  const bin = toBin(u8);
  const ex = piexif.load(bin);
  for (const ifd of IFDS) {
    for (const id of Object.keys(ex[ifd] || {})) {
      if (sel.has(nameOf(ifd, Number(id)))) delete ex[ifd][id];
    }
  }
  delete ex['1st'];
  delete ex.thumbnail;
  const exifBin = piexif.dump(ex);
  return toBytes(piexif.insert(exifBin, piexif.remove(bin)));
}

// Isi blok EXIF: apakah hanya Orientation? Dipakai pemindai struktur.
// Gagal parse dianggap berisi (lebih aman).
export function exifIsOrientationOnly(u8) {
  try {
    const ex = piexif.load(toBin(u8));
    if (ex.thumbnail) return false;
    for (const ifd of ['0th', 'Exif', 'GPS', 'Interop', '1st']) {
      for (const id of Object.keys(ex[ifd] || {})) {
        if (!(ifd === '0th' && Number(id) === piexif.ImageIFD.Orientation)) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
