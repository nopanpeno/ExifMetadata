import { describe, it, expect } from 'vitest';
import { groupOf, isSensitive, formatValue, groupFields, hasGps } from '../src/exif-groups.js';

describe('groupOf', () => {
  it('petakan field ke grup', () => {
    expect(groupOf('latitude')).toBe('lokasi');
    expect(groupOf('GPSAltitude')).toBe('lokasi');
    expect(groupOf('Model')).toBe('perangkat');
    expect(groupOf('BodySerialNumber')).toBe('perangkat');
    expect(groupOf('DateTimeOriginal')).toBe('waktu');
    expect(groupOf('ISO')).toBe('kamera');
    expect(groupOf('Whatever')).toBe('lainnya');
  });
});

describe('isSensitive', () => {
  it('tandai GPS, nomor seri, pemilik', () => {
    for (const k of ['latitude', 'GPSLongitude', 'BodySerialNumber', 'LensSerialNumber', 'OwnerName', 'Artist']) {
      expect(isSensitive(k)).toBe(true);
    }
    for (const k of ['ISO', 'Model', 'FNumber']) expect(isSensitive(k)).toBe(false);
  });
});

describe('formatValue', () => {
  it('ubah tipe ke teks', () => {
    expect(formatValue(null)).toBe('');
    expect(formatValue(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02 03:04:05');
    expect(formatValue([1, 2])).toBe('1, 2');
    expect(formatValue(new Uint8Array(4))).toBe('[data biner 4 byte]');
    expect(formatValue(1.5)).toBe('1.5');
    expect(formatValue(Number.NaN)).toBe('');
    expect(formatValue(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatValue([1, Number.NaN, 2])).toBe('1, 2');
  });
});

describe('groupFields', () => {
  it('kelompokkan, urut, buang yang kosong', () => {
    const out = groupFields({ Model: 'Pixel', ISO: 100, latitude: -6.2, longitude: 106.8, Empty: '' });
    expect(out.map((g) => g.id)).toEqual(['lokasi', 'kamera', 'perangkat']);
    expect(out[0].fields.every((f) => f.sensitive)).toBe(true);
    expect(out.flatMap((g) => g.fields).find((f) => f.key === 'Empty')).toBeUndefined();
  });
  it('kosong jika tanpa data', () => {
    expect(groupFields(null)).toEqual([]);
    expect(groupFields({})).toEqual([]);
  });
});

describe('hasGps', () => {
  it('butuh lat dan lon angka', () => {
    expect(hasGps({ latitude: 1, longitude: 2 })).toBe(true);
    expect(hasGps({ latitude: 1 })).toBe(false);
    expect(hasGps(null)).toBe(false);
  });
});
