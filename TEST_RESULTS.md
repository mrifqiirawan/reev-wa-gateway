# Hasil uji v2.7.3

- PASS — npm ci --ignore-scripts: dependency dipasang dari lockfile.
- PASS — npm run lint: TypeScript tanpa error.
- PASS — npm test: 29 tes, 29 lulus, 0 gagal.
- PASS — npm run build: bundel Vite berhasil.
- PASS — tes socket sintetis: nomor tidak terdaftar/tanpa jawaban tidak dikirim; normalisasi nomor dan alamat canonical; NACK awal/akhir; 463/479 tersimpan; receipt tidak turun; listener socket lama diabaikan.
- PASS — HTTP backend nyata lokal: NACK awal menghasilkan respons gagal, log persisten, hapus berdasarkan ID, validasi payload, proteksi antrean, penolakan tanpa sesi/admin, inbox tidak terhapus, receipt terlambat tidak menghidupkan log yang dihapus.
- PASS — regresi: lifecycle sesi, credential persistence/restart, auth, proxy, inbox LID, receipt, webhook dan API JSON.
- NOT_RUN — uji UI interaktif/browser; UI diverifikasi melalui source, typecheck, dan build saja.
- NOT_RUN — koneksi/pengiriman WhatsApp nyata, diagnosis nomor produksi, deployment Vercel/VM.

Tidak menyertakan log operasional atau data penerima dalam paket. Log ekspor pengguna hanya dipakai untuk analisis jumlah/status. Tes memakai data sintetis.
