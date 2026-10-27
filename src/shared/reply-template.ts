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
 const allowed=['pesan_asli',...(action==='belajar.profile'?profileVariables:[])];
 for(const match of template.matchAll(/\{([^{}]+)\}/g))if(!allowed.includes(match[1]))throw Error('Variabel template tidak dikenal: '+match[1]);
 if(action!=='belajar.profile'&&!template.includes('{pesan_asli}'))throw Error('Template fungsi ini wajib memuat {pesan_asli} agar rincian dan instruksi tetap lengkap.');
}
export function renderReply(action:string,template:string,original:string,ok=true):string{
 if(!ok||!template.trim())return original;
 try{validateTemplate(action,template)}catch{return original}
 const vars:Record<string,string>={pesan_asli:original};
 if(action==='belajar.profile'){
 const head=original.match(/^(.+) \(([^\n]+)\) \| NISN (\d+)\r?$/m);
 const score=original.match(/^Formatif: ([\d.,]+|—) \| Sumatif: ([\d.,]+|—)\r?$/m);
 const tasks=original.match(/^Dinilai: (\d+) \| Belum selesai: (\d+)\r?$/m);
 const points=original.match(/^Bintang: (-?\d+) \| Hati: (\d+) \| Pelanggaran aktif: (\d+)\r?$/m);
 const attendance=original.match(/^Kehadiran: ([\d.,]+|—)%\r?$/m);
 if(!head||!score||!tasks||!points||!attendance)return original;
 const number=(s:string)=>s==='—'?'Belum tersedia':s.replace('.',',');
 Object.assign(vars,{nama:head[1],kelas:head[2],nisn:head[3],formatif:number(score[1]),sumatif:number(score[2]),dinilai:tasks[1],tugas_belum:tasks[2],bintang:points[1],hati:points[2],pelanggaran:points[3],kehadiran:attendance[1]==='—'?'Belum tersedia':number(attendance[1])+'%',motivasi:Number(tasks[2])>0?'Jangan lupa selesaikan tugasmu! 🌟':'Semua tugas sudah selesai. Pertahankan semangatmu! 🌟'});
 }
 const result=template.replace(/\{([^{}]+)\}/g,(_,key)=>vars[key]??'');
 return result.trim()&&result.length<=15000?result:original;
}
