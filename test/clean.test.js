import { describe, expect, it } from 'vitest';
import { cleanAll, detectFormat } from '../src/clean.js';

const bytes = (...values) => new Blob([Uint8Array.from(values)]);

describe('format dukungan', () => {
  it('mendeteksi JPEG, PNG, dan WebP dari signature file', async () => {
    expect(await detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(await detectFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(await detectFormat(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  });

  it('menolak format yang belum didukung walau ekstensi atau MIME menyebut gambar', async () => {
    const heic = new Blob([Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])], {
      type: 'image/heic',
    });
    expect(await detectFormat(heic)).toBe(null);
    await expect(cleanAll(heic)).rejects.toThrow('Format belum didukung');
  });
});
