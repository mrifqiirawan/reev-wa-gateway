# 2.6.0

- Ganti token in-memory dan fallback browser dengan cookie HttpOnly serta session store persisten pada backend.
- Hash password dengan scrypt; simpan perubahan atomik dan cabut sesi lain.
- Tambahkan proteksi semua API admin dan API key terbatas untuk integrasi pengiriman.
- Pisahkan proxy Vercel dari backend Baileys yang aktif terus-menerus.
- Perbaiki QR stale state, polling, error yang ditelan, timeout, reconnect, dan pembersihan sesi logout.
- Pulihkan sesi WhatsApp tersimpan saat backend start.
- Perbaiki siklus refresh React yang sebelumnya bergantung pada objek fallback yang terus berubah.
- Hapus pairing code contoh dan ekspor kunci perangkat palsu; ekspor perangkat kini metadata saja.
- Hapus arsip versi lama bersarang dan kunci/browser fallback; lindungi env dan DATA_DIR dari ekspor source.
- Perbaiki konflik dependensi esbuild/Vite; sertakan npm lockfile, Dockerfile, Compose, PM2 .cjs, env, dan panduan Indonesia.
- Tambahkan 16 tes; cek TypeScript dan build frontend lulus. WhatsApp nyata, Docker, serta Vercel live belum diuji.

Lihat README bagian batas cakupan untuk fitur warisan yang masih berupa simulasi.
