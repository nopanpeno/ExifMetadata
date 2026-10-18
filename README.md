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
- Setelah proses, alat membaca ulang hasilnya dan menampilkan metadata yang masih tersisa.
