import React, {useState} from 'react';
import gas from '../../../sdk/REEV_GAS.gs?raw';
import node from '../../../sdk/reev-client.mjs?raw';
import {copyText} from '../../services/clipboard';
export const DocsSdkView: React.FC = () => {
  const [tab,setTab]=useState('gas'); const [copied,setCopied]=useState(false);
  const code=tab==='gas'?gas:node;
  return <div className="space-y-5 text-slate-300 text-sm">
    <h2 className="text-xl font-bold text-white">Panduan Integrasi REEV WA Gateway</h2>
    <section className="p-5 rounded-xl bg-[#0b1229] border border-slate-800 space-y-3">
      <h3 className="font-bold text-sky-300">Mulai dari sini</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Menu Perangkat: tautkan WhatsApp sampai status Terhubung.</li>
        <li>Menu API &amp; Webhook: klik Salin Key. Key ini rahasia dan berbeda dari password admin.</li>
        <li>Spreadsheet → Ekstensi → Apps Script. Tempel kode GAS di bawah.</li>
        <li>Project Settings → Script Properties: tambah <b>REEV_GATEWAY_URL</b> = <code>{window.location.origin}</code>, <b>REEV_API_KEY</b> = key asli, dan <b>REEV_DEVICE_ID</b> = device_primary.</li>
        <li>Untuk alamat HTTP sementara, isi <b>REEV_ALLOW_HTTP</b> = true. Gunakan HTTPS sebelum data nyata karena HTTP tidak mengenkripsi password/key.</li>
        <li>Isi <b>REEV_TEST_PHONE</b> dengan nomor Anda. Jalankan <b>tesReevWA</b> lalu berikan izin akses Google.</li>
        <li>Untuk Google Forms: A Timestamp, B Nama, C WhatsApp, D Invoice, E Total, F Status. Isi <b>REEV_ORDER_SHEET</b> sesuai nama tab. Buat satu trigger terpasang: triggerNotifikasiOrder → From spreadsheet → On form submit.</li>
      </ol>
      <p>Script Properties disimpan di server dan tidak ikut tersalin bersama kode. Batasi akses editor Apps Script karena editor tetap dapat membaca properti tersebut.</p>
      <p>Status <b>sent</b> berarti WhatsApp menerima pengiriman, bukan bukti pesan sudah diterima atau dibaca penerima.</p>
    </section>
    <section className="p-5 rounded-xl bg-[#0b1229] border border-slate-800 space-y-2">
      <h3 className="font-bold text-sky-300">API keluar berbeda dengan webhook masuk</h3>
      <p>Untuk mengirim notifikasi presensi, cukup API key dan POST /api/messages/send. Webhook tidak wajib.</p>
      <p>Webhook meneruskan peristiwa gateway ke server HTTPS Anda. Aktifkan, isi URL dan secret minimal 16 karakter, Simpan, lalu Test. Penerima harus membandingkan header X-REEV-Signature dengan sha256= + HMAC-SHA256 atas byte JSON mentah, menggunakan secret webhook.</p>
      <p>Tidak ada retry webhook otomatis pada versi ini; lihat hasil HTTP terakhir dan log penerima. Google Apps Script doPost tidak menyediakan header request arbitrer, jadi gunakan endpoint backend jika perlu verifikasi header HMAC.</p>
    </section>
    <div className="flex flex-wrap gap-4"><button onClick={()=>{setTab('gas');setCopied(false)}}>Google Apps Script</button><button onClick={()=>{setTab('node');setCopied(false)}}>Node.js backend</button><a href={'/api/export/'+tab}>Unduh kode</a><button onClick={async()=>setCopied(await copyText(code))}>{copied?'Tersalin':'Salin kode'}</button></div>
    <pre className="text-xs p-5 bg-[#020618] rounded-xl overflow-auto">{code}</pre>
    <p>Flutter/mobile: panggil backend aplikasi Anda yang memegang REEV_API_KEY. Jangan menaruh master key gateway di APK atau JavaScript browser.</p>
    <section className="p-5 bg-[#0b1229] rounded-xl"><h3 className="font-bold">Jika gagal</h3><p>401: key salah. 403: periksa BACKEND_SHARED_SECRET/proxy. 503: periksa koneksi perangkat dan isi pesan. Non-JSON: periksa alamat dan reverse proxy. Timeout: periksa log sebelum mencoba ulang untuk mencegah pesan ganda.</p></section>
  </div>;
};
