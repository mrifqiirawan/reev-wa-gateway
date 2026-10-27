export const profileTemplate=`🌸 *HAI, {nama}!*
🏫 Kelas {kelas}

📚 *HASIL BELAJARMU*
📝 Nilai saat ini: *{formatif}*
📖 Nilai ujian: {sumatif}
⏳ Tugas belum selesai: *{tugas_belum} tugas*

🏆 *PENCAPAIANMU*
⭐ Bintang: {bintang}
❤️ Hati: {hati}
🚦 Pelanggaran: {pelanggaran}

💪 Tetap semangat belajar, ya!
{motivasi}

🤖 _Reev Belajar - Informatika_ 💖`;
export const exampleReply='SISWA CONTOH (9C) | NISN 0012345678\nSemester aktif • rata-rata sementara\nFormatif: 90.40 | Sumatif: —\nDinilai: 5 | Belum selesai: 1\nBintang: 2 | Hati: 10 | Pelanggaran aktif: 0\nKehadiran: —%';
export const profileVariables=['nama','kelas','nisn','formatif','sumatif','dinilai','tugas_belum','bintang','hati','pelanggaran','kehadiran','motivasi'];
export function validateTemplate(action:string,template:string){
 if(!template.trim())return;
 const allowed=templateVariables(action);
 for(const match of template.matchAll(/\{([^{}]+)\}/g))if(!allowed.includes(match[1]))throw Error('Variabel template tidak dikenal: '+match[1]);
 if(!structuredActions.includes(action)&&!template.includes('{pesan_asli}'))throw Error('Template fungsi ini wajib memuat {pesan_asli} agar rincian dan instruksi tetap lengkap.');
}
export function renderReply(action:string,template:string,original:string,ok=true):string{
 if(!ok||!template.trim())return original;
 try{validateTemplate(action,template)}catch{return original}
 const vars:Record<string,string>={pesan_asli:original};
 if(action==='belajar.profile'){
 const head=original.match(/^(.+) \(([^\n]+)\) \| NISN (\d+)\r?$/m);
 const score=original.match(/^Formatif: ([\d.,]+|—) \| Sumatif: ([\d.,]+|—)\r?$/m);
 const tasks=original.match(/^Dinilai: (\d+) \| Belum selesai: (\d+)\r?$/m);
 const points=original.match(/^Bintang: (-?\d+) \| Hati: (\d+|belum diatur) \| Pelanggaran aktif: (\d+)\r?$/m);
 const attendance=original.match(/^Kehadiran: ([\d.,]+|—)%\r?$/m);
 if(!head||!score||!tasks||!points||!attendance)return original;
 const number=(s:string)=>s==='—'?'Belum tersedia':s.replace('.',',');
 Object.assign(vars,{nama:head[1],kelas:head[2],nisn:head[3],formatif:number(score[1]),sumatif:number(score[2]),dinilai:tasks[1],tugas_belum:tasks[2],bintang:points[1],hati:points[2],pelanggaran:points[3],kehadiran:attendance[1]==='—'?'Belum tersedia':number(attendance[1])+'%',motivasi:Number(tasks[2])>0?'Jangan lupa selesaikan tugasmu! 🌟':'Semua tugas sudah selesai. Pertahankan semangatmu! 🌟'});
 }
 if(structuredActions.includes(action)&&action!=='belajar.profile'){
  const parsed=parseDetails(action,original);if(!parsed)return original;Object.assign(vars,parsed);
 }
 const result=template.replace(/\{([^{}]+)\}/g,(_,key)=>vars[key]??'');
 return result.trim()&&result.length<=15000?result:original;
}


const footer='🤖 _Reev Belajar - Informatika_ 💖';
const identity='🌸 *HAI, {nama}!*\n🏫 Kelas {kelas}';
export const structuredActions=['belajar.profile','belajar.tasks','belajar.grades','belajar.stars','belajar.hearts','belajar.attendance'];
const variables:Record<string,string[]>={
 'belajar.profile':profileVariables,
 'belajar.tasks':['nama','kelas','nisn','daftar_tugas','jumlah_tampil','catatan','motivasi'],
 'belajar.grades':['nama','kelas','nisn','daftar_nilai','jumlah_tampil','catatan','motivasi'],
 'belajar.stars':['nama','kelas','nisn','bintang','riwayat_bintang','catatan','motivasi'],
 'belajar.hearts':['nama','kelas','nisn','hati','pelanggaran','daftar_pelanggaran','catatan','motivasi'],
 'belajar.attendance':['nama','kelas','nisn','hadir','sakit','izin','alpa','total_pertemuan','kehadiran','rekap_absen','catatan','motivasi'],
};
export function templateVariables(action:string){return ['pesan_asli',...(variables[action]??[])];}
export const helpTemplate=`🌸 *SELAMAT DATANG DI REEV BELAJAR!*
Teman belajarmu lewat WhatsApp 📱

🔗 *MULAI DI SINI*
Kirim *.infodaftar NISN* untuk menautkan nomor.
Nomor harus diverifikasi guru. Setelah data cocok, balas *YA* sesuai petunjuk, atau *BATAL* untuk membatalkan.

📚 *CEK BELAJARMU*
🌸 *.infoprofil* — Ringkasan profil
📝 *.infotugas* — Tugas belum selesai
📖 *.infonilai* — Catatan nilai
⭐ *.infobintang* — Bintang dan riwayat
❤️ *.infohati* — Hati dan pelanggaran
📅 *.infoabsen* — Rekap kehadiran

🧭 *MENU LAINNYA*
*.menu* — Daftar menu
*.point* — Saldo point
*.paket* — Pilihan paket

👩‍🏫 *KHUSUS ADMIN GURU TERDAFTAR*
Informasi siswa: perintah info diikuti NISN.
*.bintang NISN#jumlah#alasan*
*.pelanggaran NISN#alasan#tebusan*
Perubahan langsung tersimpan jika perintah berhasil. Pendaftaran tetap melalui chat pribadi bot.

💡 Kirim satu perintah dalam satu pesan. Perintah informasi menampilkan data milikmu sendiri, tanpa tambahan NISN.
Biaya point dan akses mengikuti pengaturan menu. Jika ada kendala, hubungi guru.

${footer}`;
const templates:Record<string,string>={
 'belajar.profile':profileTemplate,
 'belajar.tasks':`${identity}

📝 *TUGAS BELUM SELESAI*
📋 Ditampilkan: *{jumlah_tampil} tugas*

{daftar_tugas}

ℹ️ {catatan}
💪 {motivasi}

${footer}`,
 'belajar.grades':`${identity}

📖 *CATATAN NILAIMU*
📋 Ditampilkan: *{jumlah_tampil} tugas*

{daftar_nilai}

ℹ️ {catatan}
🌟 {motivasi}

${footer}`,
 'belajar.stars':`${identity}

🏆 *PENCAPAIANMU*
⭐ Saldo bintang: *{bintang}*

📜 *RIWAYAT BINTANG*
{riwayat_bintang}

ℹ️ {catatan}
🌟 {motivasi}

${footer}`,
 'belajar.hearts':`${identity}

❤️ *HATI & SIKAP BAIKMU*
💖 Hati: *{hati}*
🚦 Pelanggaran aktif: *{pelanggaran}*

📋 *CATATAN & TINDAK LANJUT*
{daftar_pelanggaran}

ℹ️ {catatan}
🌱 {motivasi}

${footer}`,
 'belajar.attendance':`${identity}

📅 *REKAP KEHADIRANMU*
✅ Hadir: *{hadir}*
🤒 Sakit: *{sakit}*
📩 Izin: *{izin}*
⚠️ Alpa: *{alpa}*
📚 Pertemuan tercatat: *{total_pertemuan}*
📊 Kehadiran: *{kehadiran}*

ℹ️ {catatan}
💪 {motivasi}

${footer}`,
};
export function suggestedTemplate(action:string){return templates[action]??`📚 *REEV BELAJAR*\n\n{pesan_asli}\n\n${footer}`;}
const sourceFooter='Maks. 20 tugas / 10 riwayat terbaru; detail lengkap di website.';
const sampleHead='SISWA CONTOH (9C) | NISN 0012345678';
export function exampleFor(action:string):string{
 const bodies:Record<string,string>={
 'belajar.tasks':'T001 — Algoritma sederhana: — (Belum) | tenggat 2026-11-02',
 'belajar.grades':'T001 — Algoritma sederhana: 90.40 (Selesai)\nT002 — Latihan logika: — (Belum)',
 'belajar.stars':'Saldo bintang: 2\n3 • Aktif berdiskusi\n-1 • Koreksi pencatatan',
 'belajar.hearts':'Hati: 9 | Pelanggaran aktif: 1\nP001: Terlambat mengumpulkan tugas — Perlu ditebus | tebusan: Selesaikan tugas',
 'belajar.attendance':'Hadir: 8\nSakit: 1\nIzin: 1',
 };
 return action==='belajar.profile'?exampleReply:bodies[action]?`${sampleHead}\n${bodies[action]}\n${sourceFooter}`:'Contoh hasil fungsi. Rincian aktual mengikuti data siswa.';
}
function parseDetails(action:string,original:string):Record<string,string>|null{
 const lines=original.replace(/\r\n/g,'\n').split('\n');
 const head=lines.shift()?.match(/^(.+) \(([^\n]+)\) \| NISN (\d+)$/);
 if(!head||lines.pop()!==sourceFooter)return null;
 const v:Record<string,string>={nama:head[1],kelas:head[2],nisn:head[3]};
 if(action==='belajar.stars'){
  const m=lines.shift()?.match(/^Saldo bintang: (-?\d+)$/);if(!m)return null;
  v.bintang=m[1];v.catatan='Maksimal 10 riwayat terbaru. Detail lengkap di website.';
  v.motivasi='Terus berusaha dan kumpulkan pencapaian baikmu!';
 }else if(action==='belajar.hearts'){
  const m=lines.shift()?.match(/^Hati: (\d+|belum diatur) \| Pelanggaran aktif: (\d+)$/);if(!m)return null;
  v.hati=m[1]==='belum diatur'?'Belum diatur':m[1];v.pelanggaran=m[2];
  v.catatan='Maksimal 10 catatan terbaru, termasuk yang sudah selesai. Detail lengkap di website.';
  v.motivasi=Number(m[2])>0?'Ikuti petunjuk tebusan dan hubungi guru bila perlu bantuan.':'Pertahankan sikap baikmu setiap hari!';
 }
 const empty=lines.length===1&&lines[0]==='Belum ada catatan.';
 if(!lines.length||lines.some(l=>!l))return null;
 if(action==='belajar.tasks'||action==='belajar.grades'){
  const cards:string[]=[];
  if(!empty)for(const [i,line] of lines.entries()){
   const m=line.match(/^(.+?) — (.+): (\d+(?:[.,]\d+)?|—) \(([^()]+)\)(?: \| tenggat (.+))?$/);if(!m)return null;
   cards.push(`${i+1}. *${m[1]} · ${m[2]}*\n📝 Nilai: ${m[3]==='—'?'Belum tersedia':m[3].replace('.',',')}\n📌 Status: ${m[4]}${m[5]?'\n⏰ Tenggat: '+m[5]:''}`);
  }
  v.jumlah_tampil=String(cards.length);
  v[action==='belajar.tasks'?'daftar_tugas':'daftar_nilai']=cards.join('\n\n')||(action==='belajar.tasks'?'Belum ada catatan tugas belum selesai.':'Belum ada catatan nilai.');
  v.catatan='Semester aktif · maksimal 20 tugas terbaru. Jumlah ditampilkan bukan total seluruh tugas. Detail lengkap di website.';
  v.motivasi=action==='belajar.tasks'?(empty?'Tetap semangat dan cek tugas berikutnya, ya!':'Kerjakan satu per satu dan perhatikan tenggatnya, ya!'):'Setiap latihan adalah kesempatan untuk berkembang!';
 }else if(action==='belajar.stars'){
  const cards:string[]=[];
  if(!empty)for(const line of lines){const m=line.match(/^(-?\d+) • (.*)$/);if(!m)return null;cards.push(`${Number(m[1])>=0?'⭐ +':'📝 '}${m[1]} — ${m[2]}`);}
  v.riwayat_bintang=cards.join('\n')||'Belum ada riwayat bintang.';
 }else if(action==='belajar.hearts'){
  const cards:string[]=[];
  if(!empty)for(const line of lines){const m=line.match(/^([^:]+): (.*) — (.+) \| tebusan: (.*)$/);if(!m)return null;cards.push(`📌 *${m[1]}* · ${m[2]}\n🚦 Status: ${m[3]}\n🌱 Tebusan: ${m[4]}`);}
  v.daftar_pelanggaran=cards.join('\n\n')||'Belum ada catatan pelanggaran.';
 }else if(action==='belajar.attendance'){
  const counts:Record<string,number>={Hadir:0,Sakit:0,Izin:0,Alpa:0};const seen=new Set<string>();
  if(!empty)for(const line of lines){const m=line.match(/^(Hadir|Sakit|Izin|Alpa): (\d+)$/);if(!m||seen.has(m[1])||!Number.isSafeInteger(Number(m[2])))return null;seen.add(m[1]);counts[m[1]]=Number(m[2]);}
  const total=Object.values(counts).reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(total))return null;
  Object.assign(v,{hadir:String(counts.Hadir),sakit:String(counts.Sakit),izin:String(counts.Izin),alpa:String(counts.Alpa),total_pertemuan:String(total),kehadiran:total?(100*counts.Hadir/total).toFixed(1).replace('.',',')+'%':'Belum tersedia',rekap_absen:empty?'Belum ada catatan kehadiran.':lines.join('\n'),catatan:'Semester aktif · persentase dihitung dari pertemuan yang tercatat. Detail lengkap di website.',motivasi:empty?'Catatan kehadiran akan tampil setelah diisi guru.':'Terus jaga semangat hadir dan belajar, ya!'});
 }
 return v;
}
