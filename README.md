# ExifMetadata

Alat web statis untuk melihat metadata EXIF foto, memilih bagian yang mau dibuang, lalu mengunduh foto bersih. Semua proses jalan di browser. Foto tidak pernah diunggah ke server.

Spesifikasi lengkap: [docs/PRD.md](docs/PRD.md).

Status: dalam pengembangan.

## Jalankan

```bash
npm install
npm run dev     # server lokal
npm test        # tes
npm run build   # hasil di dist/
```

## Cara hapus metadata

- **JPEG**: segmen metadata dibuang langsung dari file (EXIF, GPS, XMP, IPTC, komentar, thumbnail). Piksel tidak berubah. Orientasi foto bisa dipertahankan.
- **Hapus terpilih** (JPEG): buang field EXIF yang dicentang. XMP dan IPTC hanya hilang lewat Hapus semua.
- **PNG, WebP**: gambar ulang lewat canvas. WebP bisa sedikit turun kualitas.
- Hanya JPEG, PNG, dan WebP yang diterima. HEIC dan TIFF belum didukung.
- Setelah proses, alat memindai struktur file hasil (segmen JPEG, chunk PNG dan WebP) untuk mencari wadah metadata yang tersisa, lalu membaca ulang EXIF dengan `exifr`; ini bukan jaminan bahwa setiap jenis metadata lain sudah hilang. Untuk kebutuhan privasi sensitif, verifikasi hasil dengan alat metadata independen.

## Peta GPS

Mati bawaan. Jika foto punya GPS, tombol "Nyalakan peta" memuat Leaflet dan ubin OpenStreetMap. Hanya saat itu browser menghubungi `tile.openstreetmap.org`, dan yang terkirim hanya nomor ubin, bukan foto.

## Foto contoh untuk tes

`python3 test/fixtures/make.py` (butuh Pillow) membuat ulang foto di `test/fixtures/`.

## Keamanan jaringan

Build produksi memasang Content-Security-Policy: browser hanya boleh memuat berkas dari situs sendiri dan gambar ubin dari `tile.openstreetmap.org`. `connect-src` hanya `'self'`, jadi skrip tidak bisa mengirim foto ke luar.

## Deploy

1. Di GitHub: Settings → Pages → Source: **GitHub Actions**.
2. Setiap push ke `main` menjalankan tes, build, lalu deploy (`.github/workflows/pages.yml`).
3. `.github/workflows/ci.yml` menjalankan tes dan build di setiap PR.

## Verifikasi dengan ExifTool

`npm test` ikut menjalankan `test/exiftool.test.js`. ExifTool (dipasang lewat devDependency `exiftool-vendored`, versi dikunci, butuh Perl di Linux/macOS) membaca file hasil dan harus menemukan nol metadata foto. Data uji disisipi XMP, IPTC, komentar, dan data setelah akhir gambar. Ini pembanding independen dari kode alat ini sendiri, dan jalan di CI pada setiap PR.
