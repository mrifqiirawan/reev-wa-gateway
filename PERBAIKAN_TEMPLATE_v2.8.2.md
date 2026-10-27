# Perbaikan penerapan template, versi tetap 2.8.2

Revisi ini memperbaiki jalur bot yang sebelumnya meneruskan r.text langsung tanpa renderReply. Formatter kini diterapkan sebelum gw_finish menyimpan balasan dan sebelum pengiriman WhatsApp. Pola pembaca profil dan fixture pratinjau memakai escape/newline yang benar.

Sesudah memasang isi ZIP revisi ini ke GitHub, jalankan di VM:

```bash
cd /opt/reev-wa-gateway
git pull --ff-only
npm ci --no-audit --no-fund
npm run lint
npm run build
```

Pastikan setiap langkah berhasil, kemudian gunakan script upgrade yang sudah Anda buat:

```bash
bash -n /root/upgrade-reev-282.sh && bash /root/upgrade-reev-282.sh
```

Script tersebut memakai staging /opt/reev-wa-gateway dan aplikasi aktif /root/reev-wa-gateway serta backup sesi. Lihat Panduan_v2.8.2.md yang diberikan terpisah untuk isi script lengkap jika belum tersedia.

Pastikan source aktif benar-benar memanggil formatter:

```bash
grep -n 'renderReply(f.action' /root/reev-wa-gateway/src/server/bot-engine.ts
```

Harus muncul pemanggilan renderReply(f.action,f.text,r.text,r.ok). Health versi 2.8.2 saja tidak membedakan paket lama dan revisi ini karena nomor versi sama.

Buka Menu, Paket & Point → Menu & fungsi → .infoprofil, pastikan Jalankan fungsi = Profil siswa. Pilih Gunakan contoh menarik atau tempel template Anda pada Template balasan .infoprofil, lalu Simpan. Uji perintah .infoprofil dari nomor yang sudah tertaut. Setiap fungsi memiliki template masing-masing, sehingga template profil tidak otomatis berlaku pada perintah lain.

Tidak ada SQL baru atau perubahan source REEV BELAJAR. Tidak ada tambahan request database untuk formatting. Pesan gagal memakai teks asli; template kosong memakai teks asli; format sumber yang tidak cocok memakai teks asli.

Pengujian mencakup hasil fungsi berbentuk teks multiline asli sampai gw_finish dan callback pengiriman. Identitas pengujian memakai data sintetis. Verifikasi VM dan pengiriman WhatsApp nyata belum dilakukan.
