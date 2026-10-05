# KMZ Dummy House Checker

Web statis untuk mencocokkan daftar nomor rumah dummy dengan nama `Placemark` di file KMZ.

## Fitur

- Upload KMZ langsung di browser.
- Daftar 97 nomor dummy sudah menjadi default dan dapat diedit.
- Menampilkan:
  - nomor yang ada di KMZ,
  - nomor yang tidak ada,
  - Placemark tambahan di KMZ,
  - seluruh label KMZ.
- Menghasilkan KMZ baru yang hanya mempertahankan Placemark sesuai daftar dummy.
- Opsional menghapus foto di folder `files/` yang sudah tidak direferensikan.
- Ekspor hasil perbandingan ke CSV.
- Tidak memakai backend, database, PHP, Node.js, atau API server.
- Tidak memakai library/CDN eksternal. Seluruh engine ZIP/KMZ ada di `app.js`.

## Cara pakai lokal

Cukup buka `index.html` dengan Chrome, Edge, atau Firefox versi terbaru. Tidak perlu instalasi.

## Upload ke GitHub Pages

1. Buat repository baru di GitHub.
2. Upload seluruh isi folder ini ke root repository (`index.html`, `app.js`, `style.css`, `.nojekyll`, `README.md`).
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.
6. GitHub akan memberikan URL Pages untuk web ini.

> Catatan: GitHub Pages hanya menyajikan file statis. File KMZ yang dipilih pengguna diproses di browser dan tidak dikirim ke server aplikasi.

## Dukungan KMZ

Engine mendukung ZIP/KMZ standar non-encrypted, non-ZIP64, dengan kompresi `Store (0)` dan `Deflate (8)`. Ini sesuai dengan format KMZ yang umum dan telah disiapkan untuk struktur KMZ contoh proyek Pekayon.
