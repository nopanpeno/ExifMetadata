// Logika murni: kelompokkan field EXIF dan tandai yang sensitif.

export const GROUPS = [
  { id: 'lokasi', label: 'Lokasi' },
  { id: 'kamera', label: 'Kamera' },
  { id: 'waktu', label: 'Waktu' },
  { id: 'perangkat', label: 'Perangkat' },
  { id: 'lainnya', label: 'Lainnya' },
];

const LOKASI = /^(GPS|latitude$|longitude$)/i;
const WAKTU = /(date|time)/i;
const PERANGKAT = /^(Make|Model|Software|HostComputer|LensMake|LensModel|LensInfo|.*Serial.*|Owner.*|CameraOwner.*|Artist|Copyright)$/i;
const KAMERA = /^(ISO|ISOSpeedRatings|ExposureTime|FNumber|ApertureValue|ShutterSpeedValue|FocalLength|FocalLengthIn35mmFormat|ExposureProgram|ExposureCompensation|ExposureMode|MeteringMode|Flash|WhiteBalance|Orientation|ColorSpace|BrightnessValue|SceneType|SceneCaptureType|DigitalZoomRatio|SensingMethod|ExifImageWidth|ExifImageHeight|PixelXDimension|PixelYDimension|XResolution|YResolution|ResolutionUnit)$/i;
const SENSITIF = /^(GPS|latitude$|longitude$|.*Serial.*|Owner.*|CameraOwner.*|Artist|HostComputer)/i;

export function groupOf(key) {
  if (LOKASI.test(key)) return 'lokasi';
  if (PERANGKAT.test(key)) return 'perangkat';
  if (WAKTU.test(key)) return 'waktu';
  if (KAMERA.test(key)) return 'kamera';
  return 'lainnya';
}

export function isSensitive(key) {
  return SENSITIF.test(key);
}

export function formatValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    // exifr membuat Date lokal dari teks tanpa zona; tampilkan apa adanya, bukan UTC.
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
    return `[data biner ${v.byteLength} byte]`;
  }
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// data: objek datar dari exifr. Hasil: grup berisi field, grup kosong dibuang.
export function groupFields(data) {
  if (!data || typeof data !== 'object') return [];
  const buckets = Object.fromEntries(GROUPS.map((g) => [g.id, []]));
  for (const key of Object.keys(data).sort()) {
    const value = formatValue(data[key]);
    if (value === '') continue;
    buckets[groupOf(key)].push({ key, value, sensitive: isSensitive(key) });
  }
  return GROUPS.filter((g) => buckets[g.id].length).map((g) => ({
    ...g,
    fields: buckets[g.id],
  }));
}

export function hasGps(data) {
  return (
    !!data &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude)
  );
}
