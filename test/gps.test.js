import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compass, decimalText, mapLinks, gpsDetails, accuracyMeters } from '../src/gps.js';
import { readExif } from '../src/exif-read.js';

describe('compass', () => {
  it('delapan arah, termasuk pembulatan dan putaran', () => {
    expect(compass(0)).toBe('Utara');
    expect(compass(90)).toBe('Timur');
    expect(compass(200)).toBe('Selatan');
    expect(compass(359)).toBe('Utara');
    expect(compass(-90)).toBe('Barat');
    expect(compass(315)).toBe('Barat Laut');
  });
});

describe('koordinat dan tautan', () => {
  it('teks desimal untuk disalin', () => {
    expect(decimalText(-6.2, 106.8)).toBe('-6.200000, 106.800000');
  });
  it('tautan OSM dan Google Maps', () => {
    const l = mapLinks(-6.2, 106.8);
    expect(l.osm).toBe('https://www.openstreetmap.org/?mlat=-6.200000&mlon=106.800000#map=17/-6.200000/106.800000');
    expect(l.google).toBe('https://www.google.com/maps?q=-6.200000,106.800000');
  });
});

describe('gpsDetails', () => {
  it('tanpa data: kosong', () => {
    expect(gpsDetails(null)).toEqual([]);
    expect(gpsDetails({})).toEqual([]);
  });
  it('membaca ketinggian, arah, kecepatan, akurasi, waktu', () => {
    const rows = gpsDetails({
      GPSAltitude: 123.44, GPSAltitudeRef: 0, GPSImgDirection: 90, GPSSpeed: 40, GPSSpeedRef: 'K',
      GPSHPositioningError: 5, GPSDateStamp: '2026:01:02', GPSTimeStamp: [3, 4, 5],
    });
    expect(Object.fromEntries(rows.map((r) => [r.label, r.value]))).toEqual({
      Ketinggian: '123.4 m di atas permukaan laut',
      'Arah kamera': '90° (Timur)',
      Kecepatan: '40 km/jam',
      Akurasi: 'sekitar 5 m',
      'Waktu GPS': '2026-01-02 03:04:05 UTC',
    });
  });
  it('ref ketinggian di bawah laut: angka, teks, objek byte', () => {
    for (const ref of [1, 'Below Sea Level', { 0: 1 }]) {
      expect(gpsDetails({ GPSAltitude: 5, GPSAltitudeRef: ref })[0].value).toContain('di bawah');
    }
  });
  it('waktu berupa teks dari exifr', () => {
    expect(gpsDetails({ GPSTimeStamp: '3:4:5' })[0].value).toBe('03:04:05 UTC');
  });
  it('nilai bukan angka diabaikan', () => {
    expect(gpsDetails({ GPSAltitude: 'x', GPSSpeed: NaN, GPSImgDirection: null })).toEqual([]);
  });
});

describe('akurasi', () => {
  it('hanya angka positif', () => {
    expect(accuracyMeters({ GPSHPositioningError: 5 })).toBe(5);
    expect(accuracyMeters({ GPSHPositioningError: 0 })).toBe(null);
    expect(accuracyMeters({})).toBe(null);
    expect(accuracyMeters(null)).toBe(null);
  });
});

it('foto contoh gps-detail.jpg terbaca penuh', async () => {
  const buf = new Uint8Array(readFileSync(new URL('./fixtures/gps-detail.jpg', import.meta.url)));
  const data = await readExif(buf);
  const labels = gpsDetails(data).map((r) => r.label);
  expect(labels).toEqual(['Ketinggian', 'Arah kamera', 'Kecepatan', 'Akurasi', 'Waktu GPS']);
  expect(accuracyMeters(data)).toBe(5);
});
