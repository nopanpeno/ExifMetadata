// Rincian GPS dan tautan peta. Logika murni, tanpa jaringan.

const COMPASS = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];

export function compass(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function decimalText(lat, lon) {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

// Tautan buka di peta luar. Koordinat baru terkirim ke sana saat pengguna mengklik.
export function mapLinks(lat, lon) {
  const a = lat.toFixed(6);
  const b = lon.toFixed(6);
  return {
    osm: `https://www.openstreetmap.org/?mlat=${a}&mlon=${b}#map=17/${a}/${b}`,
    google: `https://www.google.com/maps?q=${a},${b}`,
  };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round1 = (n) => String(Math.round(n * 10) / 10);

// Nilai Ref bisa berupa angka, teks, atau objek bertipe byte tergantung kamera.
function refValue(v) {
  if (v && typeof v === 'object') return Object.values(v)[0];
  return v;
}

function timeText(v) {
  if (Array.isArray(v)) return v.map((n) => String(Math.trunc(n)).padStart(2, '0')).join(':');
  if (typeof v === 'string') return v.split(':').map((n) => n.padStart(2, '0')).join(':');
  return null;
}

// Rincian di luar koordinat: ketinggian, arah, kecepatan, akurasi, waktu GPS.
// Hasil: [{ label, value }], hanya yang ada.
export function gpsDetails(data) {
  if (!data) return [];
  const rows = [];
  const alt = num(data.GPSAltitude);
  if (alt !== null) {
    const ref = refValue(data.GPSAltitudeRef);
    const below = ref === 1 || /below/i.test(String(ref));
    rows.push({ label: 'Ketinggian', value: `${round1(alt)} m ${below ? 'di bawah' : 'di atas'} permukaan laut` });
  }
  const dir = num(data.GPSImgDirection);
  if (dir !== null) rows.push({ label: 'Arah kamera', value: `${Math.round(dir)}° (${compass(dir)})` });
  const speed = num(data.GPSSpeed);
  if (speed !== null) {
    const unit = { K: 'km/jam', M: 'mil/jam', N: 'knot' }[refValue(data.GPSSpeedRef)] ?? '';
    rows.push({ label: 'Kecepatan', value: `${round1(speed)} ${unit}`.trim() });
  }
  const acc = num(data.GPSHPositioningError);
  if (acc !== null) rows.push({ label: 'Akurasi', value: `sekitar ${round1(acc)} m` });
  const date = typeof data.GPSDateStamp === 'string' ? data.GPSDateStamp.replaceAll(':', '-') : null;
  const time = timeText(data.GPSTimeStamp);
  if (date || time) rows.push({ label: 'Waktu GPS', value: [date, time].filter(Boolean).join(' ') + ' UTC' });
  return rows;
}

export function accuracyMeters(data) {
  const a = data && num(data.GPSHPositioningError);
  return a !== null && a > 0 ? a : null;
}
