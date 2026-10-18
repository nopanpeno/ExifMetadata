import exifr from 'exifr';

// Baca metadata di browser. File tidak dikirim ke jaringan.
export async function readExif(file) {
  const data = await exifr.parse(file, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: true,
    iptc: true,
    icc: false,
    interop: false,
    ifd1: false, // thumbnail tidak perlu ditampilkan
    mergeOutput: true,
    translateValues: true,
    reviveValues: true,
  });
  return data || {};
}
