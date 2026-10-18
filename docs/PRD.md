# PRD: EXIF Viewer dan Cleaner

Oct 18, 2026 · @nopanpeno

Alat web statis untuk melihat metadata EXIF foto, memilih bagian yang mau dibuang, lalu mengunduh foto bersih. Semua proses jalan di browser, tanpa backend, tanpa unggah ke server.

## Latar belakang dan tujuan

Foto dari ponsel membawa metadata EXIF berisi model kamera, waktu, dan sering titik GPS. Orang jarang sadar, dan alat penghapus yang ada biasanya meminta unggah foto ke server orang lain. Produk ini menampilkan isi EXIF dulu, lalu membiarkan pengguna memilih apa yang dibuang, semua di perangkat sendiri.

**Tujuan**

- Menampilkan semua metadata EXIF yang terbaca, dengan titik GPS di peta.

- Menghapus metadata terpilih tanpa menurunkan kualitas foto.

- Foto tidak pernah keluar dari browser pengguna.

**Bukan tujuan (versi 1)**

- Akun, login, atau penyimpanan di server.

- Mengedit metadata menjadi nilai palsu.

- Editor foto: crop, filter, kompres.

## Pengguna sasaran

| Pengguna                         | Kebutuhan                                     | Alasan pakai alat ini                |
|----------------------------------|-----------------------------------------------|--------------------------------------|
| Orang awam yang jual-beli online | Foto barang tidak bocorkan lokasi rumah       | Tidak perlu daftar atau unggah       |
| Jurnalis dan aktivis             | Bagikan foto tanpa jejak lokasi dan perangkat | Data tidak lewat server pihak ketiga |
| Fotografer hobi                  | Lihat setelan kamera (ISO, rana, lensa)       | Tampilan rapi, bisa dibaca cepat     |
| Pelajar dan developer            | Belajar isi EXIF                              | Semua field terbaca dan dijelaskan   |

## Fitur dan prioritas

| Fitur                          | Deskripsi                                                    | Prioritas |
|--------------------------------|--------------------------------------------------------------|-----------|
| Unggah foto                    | Seret-lepas atau pilih file; JPEG, HEIC, PNG, WebP, TIFF     | MVP       |
| Tampil EXIF                    | Daftar field dikelompokkan: kamera, waktu, lokasi, perangkat | MVP       |
| Peta GPS                       | Titik lokasi foto di peta, tanpa kirim foto                  | MVP       |
| Hapus semua                    | Satu tombol, hasil diunduh sebagai file baru                 | MVP       |
| Hapus terpilih                 | Centang field yang dibuang, sisanya tetap                    | MVP       |
| Peringatan risiko              | Tandai field sensitif (GPS, nomor seri) berwarna merah       | MVP       |
| Proses banyak foto             | Unggah banyak file, unduh sebagai ZIP                        | Versi 1.1 |
| Mode PWA offline               | Bisa dipasang dan dipakai tanpa internet                     | Versi 1.1 |
| Bandingkan sebelum dan sesudah | Lihat beda metadata dua versi                                | Nanti     |

## Alur pengguna

1.  Pengguna membuka halaman dan melihat catatan: "Foto tidak keluar dari perangkatmu."

2.  Pengguna menyeret foto ke area unggah.

3.  Alat membaca EXIF dan menampilkan daftar, dengan field sensitif ditandai.

4.  Jika ada GPS, peta menampilkan titik lokasinya.

5.  Pengguna memilih "Hapus semua" atau mencentang field yang mau dibuang.

6.  Alat membuat file baru dan menampilkan pratinjau hasil, dengan daftar EXIF yang tersisa.

7.  Pengguna mengunduh foto bersih.

## Spesifikasi teknis

| Bagian                    | Pilihan                                                            | Catatan                                         |
|---------------------------|--------------------------------------------------------------------|-------------------------------------------------|
| Antarmuka                 | HTML, CSS, JavaScript biasa atau framework ringan (Svelte, Preact) | Bundel kecil, muat cepat                        |
| Baca EXIF                 | exifr                                                              | Mendukung JPEG, HEIC, PNG, TIFF                 |
| Hapus EXIF terpilih       | piexifjs                                                           | Hanya JPEG; kualitas piksel tidak berubah       |
| Hapus semua (format lain) | Gambar ulang lewat canvas, ekspor lagi                             | Semua metadata hilang, tapi kualitas bisa turun |
| Baca file                 | Input file dan FileReader                                          | Tanpa unggah ke jaringan                        |
| Unduh hasil               | Blob dan URL.createObjectURL                                       | Tanpa server                                    |
| Peta                      | Leaflet dengan ubin OpenStreetMap                                  | Hanya koordinat yang dipakai untuk ubin         |
| Hosting                   | GitHub Pages atau Netlify                                          | Statis, gratis                                  |

**Batasan teknis:** HEIC perlu dikonversi ke JPEG untuk dibuang EXIF-nya secara terpilih; ukuran file besar (di atas 20 MB) dibaca lewat Web Worker supaya halaman tidak macet.

## Privasi, risiko dan batasan

Janji utama produk: foto tidak dikirim ke server mana pun. Peta adalah satu-satunya permintaan jaringan, dan yang dikirim hanya koordinat ubin, bukan foto.

| Risiko                                                   | Dampak                              | Penanganan                                                |
|----------------------------------------------------------|-------------------------------------|-----------------------------------------------------------|
| Ubin peta membocorkan lokasi yang dilihat                | Penyedia peta tahu area yang dibuka | Tampilkan peringatan; sediakan pilihan matikan peta       |
| Hapus via canvas menurunkan kualitas                     | Foto tampak lebih buram             | Beri pilihan jalur tanpa kompres ulang untuk JPEG         |
| Metadata tersimpan di tempat lain (XMP, IPTC, thumbnail) | Hasil masih membawa jejak           | Baca dan hapus XMP dan IPTC; uji dengan alat pembaca lain |
| Pengguna mengira foto sudah bersih padahal belum         | Kebocoran lokasi                    | Tampilkan daftar metadata sisa setelah proses             |
| Library berhenti dirawat                                 | Bug atau celah                      | Kunci versi; tulis tes dengan foto contoh                 |

## Metrik sukses dan milestone

**Metrik.** Tanpa server berarti tanpa pelacakan pengguna. Ukur lewat hal yang tidak mengumpulkan data pribadi.

| Metrik                                         | Target 3 bulan pertama | Cara ukur                       |
|------------------------------------------------|------------------------|---------------------------------|
| Bintang di GitHub                              | 100                    | Repositori publik               |
| Foto bersih menurut alat pembanding (ExifTool) | 100% pada set uji      | Tes otomatis dengan foto contoh |
| Waktu proses foto 10 MB                        | Di bawah 2 detik       | Uji manual di ponsel menengah   |
| Skor Lighthouse                                | Di atas 90             | Uji saat rilis                  |

**Milestone.**

| Minggu | Hasil                                                    |
|--------|----------------------------------------------------------|
| 1      | Unggah foto dan tampil EXIF                              |
| 2      | Hapus semua dan hapus terpilih untuk JPEG                |
| 3      | Peta GPS, penanda field sensitif, tes dengan foto contoh |
| 4      | Rapikan tampilan, uji di ponsel, rilis di hosting statis |

**Pertanyaan terbuka**

- [ ] Peta dipasang bawaan atau hanya aktif jika pengguna menyalakan?

- [ ] Dukung HEIC penuh di versi 1, atau tunda ke 1.1?

- [ ] Bahasa antarmuka: Indonesia saja atau dua bahasa?
