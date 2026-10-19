// Baca dan tulis Orientation pada blok TIFF/EXIF mentah (dipakai PNG eXIf dan WebP EXIF).

// Kembalikan 1..8; 1 jika tidak ada atau tidak terbaca.
export function readTiffOrientation(bytes) {
  let b = bytes;
  // WebP kadang memakai awalan "Exif\0\0"
  if (b.length > 6 && b[0] === 0x45 && b[1] === 0x78 && b[2] === 0x69 && b[3] === 0x66) b = b.subarray(6);
  if (b.length < 14) return 1;
  const little = b[0] === 0x49 && b[1] === 0x49;
  if (!little && !(b[0] === 0x4d && b[1] === 0x4d)) return 1;
  const u16 = (o) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  if (ifd + 2 > b.length) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > b.length) return 1;
    if (u16(e) === 0x0112 && u16(e + 2) === 3) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

// Blok TIFF minimal (big-endian) yang hanya berisi Orientation.
export function makeOrientationTiff(o) {
  return Uint8Array.from([
    0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, // header, IFD0 di offset 8
    0, 1, // satu entri
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, // Orientation, SHORT, nilai o
    0, 0, 0, 0, // tidak ada IFD berikutnya
  ]);
}

// Blok TIFF yang isinya hanya satu tag Orientation dan tanpa IFD lanjutan.
export function isOrientationOnlyTiff(bytes) {
  let b = bytes;
  if (b.length > 6 && b[0] === 0x45 && b[1] === 0x78 && b[2] === 0x69 && b[3] === 0x66) b = b.subarray(6);
  if (b.length < 14) return false;
  const little = b[0] === 0x49 && b[1] === 0x49;
  if (!little && !(b[0] === 0x4d && b[1] === 0x4d)) return false;
  const u16 = (o) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const ifd = u32(4);
  if (ifd + 2 > b.length || u16(ifd) !== 1) return false;
  const e = ifd + 2;
  if (e + 16 > b.length || u16(e) !== 0x0112) return false;
  return u32(e + 12) === 0;
}
