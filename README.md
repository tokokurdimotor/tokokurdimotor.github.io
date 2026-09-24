# Toko Kurdi Motor

Website statis bengkel mobil dan sparepart di Warureja, Tegal.

## Menjalankan lokal

Jalankan `python -m http.server 4173 --bind 127.0.0.1`, lalu buka http://127.0.0.1:4173. Tidak memerlukan proses build atau database.

## Mengubah konten

Pemilik dapat mengelola konten dari HP melalui **https://tokokurdimotor.github.io/admin/**. Lihat [panduan panel pemilik](admin/README.md) untuk login token GitHub, mengganti logo/foto, teks dua bahasa, kontak, dan data produk.

Sumber konten yang dikelola panel adalah `assets/data/site-content.json`; `assets/js/content.js` menerapkannya pada website. Penerbitan melalui panel juga menyelaraskan HTML untuk tampilan tanpa JavaScript. Jika mengedit kode manual, periksa data ini agar konten lama tidak menimpa hasil edit saat halaman dibuka.

- Halaman: `index.html`, `about.html`, `gallery.html`, `contact.html`, `404.html`.
- Desain aktif: `assets/css/modern.css`.
- Kontak, peta, galeri, dan perilaku bersama: `assets/js/main.js`.
- Terjemahan beranda dan komponen baru: `assets/js/modern.js`.
- Foto WebP di `assets/img/` dioptimalkan dari foto asli yang tetap disimpan.
- Untuk teks dengan `data-i18n`, perbarui teks HTML dan terjemahan ID/EN.

Desain menggunakan arang, putih hangat, oranye, font Plus Jakarta Sans, dan foto toko asli. Informasi layanan, nomor WhatsApp, alamat, serta riwayat sejak 2008 berasal dari website sebelumnya. Stok dan harga dikonfirmasi melalui WhatsApp; kategori sparepart bukan inventaris langsung.

## Pemeriksaan

Dengan Node.js, Playwright, dan Microsoft Edge tersedia, jalankan `node tools/check-site.cjs` saat server lokal aktif. Jika Playwright terpasang di folder lain, set `PLAYWRIGHT_MODULE` ke lokasi modulnya. `SITE_URL` dapat diubah untuk mengecek deployment; `SCREENSHOT_DIR` mengatur lokasi screenshot.

Pemeriksaan mencakup lima halaman pada lebar 375, 667 (landscape), 768, 1024, dan 1440 piksel dalam bahasa Indonesia dan Inggris; overflow, terjemahan, menu mobile, FAQ, validasi formulir, tautan WhatsApp, reduced motion, konten tanpa JavaScript, aset lokal, dan error JavaScript. Pengujian formulir mencegat `window.open`: tidak mengirim pesan WhatsApp.

Google Analytics dan peta eksternal dikecualikan dari pengujian otomatis; ketersediaan layanan pihak ketiga tidak dijamin oleh tes lokal.

## Publikasi

Website diterbitkan melalui GitHub Pages. Workflow cache-bust memperbarui versi stylesheet dan skrip setelah push ke `main`, agar pengunjung menerima aset terbaru. Tidak ada kredensial yang diperlukan oleh kode frontend.
