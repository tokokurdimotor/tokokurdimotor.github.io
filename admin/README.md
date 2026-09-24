# Panel pemilik Kurdi Motor

Buka **https://tokokurdimotor.github.io/admin/** dari HP atau komputer.

## Masuk pertama kali

1. Masuk ke GitHub sebagai `tokokurdimotor`.
2. Buka https://github.com/settings/personal-access-tokens/new.
3. Buat fine-grained token bernama **Admin Kurdi Motor**, dengan masa berlaku terbatas.
4. Repository access: **Only select repositories → tokokurdimotor.github.io**.
5. Repository permissions: **Contents → Read and write**. Metadata tetap Read-only. Izin lain tidak diperlukan.
6. Generate token. Simpan di pengelola kata sandi pribadi dan tempel pada kolom token di panel. Jangan kirim token melalui chat atau memasukkannya dalam file repositori.

Panel memakai GitHub REST API langsung. Token hanya berada dalam memori tab, tidak di localStorage, sessionStorage, cookie, URL, draf, atau commit. Keluar atau memuat ulang mengakhiri sesi. Token yang dibuat tetap berlaku di GitHub sampai kedaluwarsa atau dicabut; cabut melalui Settings → Developer settings → Personal access tokens jika tidak lagi digunakan.

Tampilan login merupakan file statis yang dapat dibuka pengunjung. Otorisasi perubahan dilakukan oleh GitHub, bukan oleh kerahasiaan alamat `/admin/`. Panel memeriksa akun pemilik dan hak push sebelum membuka editor. Token yang hanya memiliki izin baca tidak dapat menerbitkan perubahan.

## Mengubah website

- **Identitas & kontak:** nama, tulisan merek, tagline, nomor WhatsApp, alamat, jam buka, Google Maps, dan logo.
- **Konten halaman:** judul/deskripsi pencarian, teks Indonesia dan Inggris, teks tambahan, dan foto beranda/tentang. Teks bersama berlaku pada beberapa halaman. Bagian ini mengubah isi, bukan struktur atau desain kode.
- **Galeri foto:** tambah, ganti, ubah deskripsi, naikkan urutan, atau hapus dari galeri.
- **Data produk:** cari, tambah, edit, atau hapus baris di `assets/data/products.csv`. Data awal berisi 2.590 produk. Beberapa ID lama sudah duplikat karena format angka spreadsheet; panel mempertahankannya tetapi menolak penambahan duplikat baru. Halaman publik saat ini menampilkan kategori, bukan katalog seluruh produk. Harga produk di panel tidak otomatis menjadi daftar harga di beranda.
- **Tinjau & terbitkan:** periksa nilai sebelum/sesudah, kemudian tekan Terbitkan. Ini membuat satu commit atomik berisi data, HTML statis, dan gambar baru. GitHub Pages memperbarui website setelah build berhasil; tombol sukses berarti tersimpan di GitHub, bukan konfirmasi selesai tayang.

Foto: PNG/JPG/WebP, maksimal 4 MB per file, 20 unggahan dalam satu penerbitan. Gunakan foto secukupnya agar situs ringan. Menghapus foto dari galeri tidak menghapus file atau riwayat GitHub.

Jam buka promosi di beranda dan salinan bahasa Inggris merupakan konten tersendiri. Saat mengganti jam operasional, periksa teks promosi terkait di Konten halaman agar konsisten.

## Draf dan konflik

Draf belum tayang sampai diterbitkan. Panel memperingatkan saat tab dengan draf ditutup. Ekspor draf untuk menyimpan salinan JSON tanpa token. File dapat diimpor kembali di bagian Tinjau & terbitkan.

Jika ada perubahan dari komputer lain atau workflow GitHub saat panel terbuka, penerbitan ditolak. Ekspor draf, muat ulang data, impor draf, lalu **tinjau semua perbedaan**: impor adalah penggantian draf lengkap, bukan penggabungan otomatis. Simpan hanya perubahan yang memang diinginkan. Penerbitan tidak pernah menggunakan force push.

Jika koneksi putus saat menerbitkan, periksa riwayat GitHub atau muat ulang data sebelum mencoba lagi. GitHub mungkin sudah menerima commit meskipun respons tidak sampai ke browser.

Pemulihan perubahan yang sudah terbit dilakukan dengan revert commit melalui GitHub/Git. Panel belum memiliki tombol pemulihan riwayat.

## Pengujian pengembang

Jalankan server statis di root repositori: `python -m http.server 4173 --bind 127.0.0.1`.

Dengan Playwright tersedia, jalankan `node tools/check-admin.cjs` dan `node tools/check-site.cjs`. Variabel `PLAYWRIGHT_MODULE` dapat menunjuk instalasi Playwright lain. Tes admin memakai respons GitHub tiruan, tidak menerbitkan perubahan produksi atau menyimpan token sungguhan. Tes memeriksa otorisasi, tampilan HP, konflik versi, penerbitan atomik, unggahan, dan integrasi konten publik.
