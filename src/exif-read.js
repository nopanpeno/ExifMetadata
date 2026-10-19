import exifr from 'exifr';
import { isWebp, webpMetadata } from './webp.js';

const OPTIONS = {
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
};

async function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(await input.arrayBuffer());
}

// Baca metadata di browser. File tidak dikirim ke jaringan.
// exifr tidak mengenal WebP: blok EXIF diambil sendiri lalu dibaca sebagai TIFF.
export async function readExif(input) {
  const head = input instanceof Uint8Array ? input.subarray(0, 12) : new Uint8Array(await input.slice(0, 12).arrayBuffer());
  if (isWebp(head)) {
    const { exif, xmp } = webpMetadata(await bytesOf(input));
    const data = exif ? (await exifr.parse(exif, OPTIONS)) || {} : {};
    // Isi XMP tidak diurai; keberadaannya ditampilkan supaya tidak tersembunyi.
    if (xmp) data.XMP = xmp;
    return data;
  }
  return (await exifr.parse(input, OPTIONS)) || {};
}
