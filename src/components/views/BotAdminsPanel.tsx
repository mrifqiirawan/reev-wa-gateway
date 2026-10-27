import React,{useEffect,useState} from 'react';
import {apiService} from '../../services/api';
const cls='rounded-lg border border-slate-700 bg-slate-950 p-3';
type Admin={phone:string;profile_id:string;name:string;active:boolean;teacher_active:boolean};
export function BotAdminsPanel(){
 const [rows,R]=useState<Admin[]>([]),[teachers,T]=useState<{id:string;name:string}[]>([]),[phone,P]=useState(''),[profile,S]=useState(''),[active,A]=useState(true),[busy,B]=useState(false),[error,E]=useState(''),[notice,N]=useState('');
 const load=async()=>{const d=await apiService.botRequest<any>('/admins');R(d.admins);T(d.teachers)};
 useEffect(()=>{B(true);load().catch(e=>E(e.message)).finally(()=>B(false))},[]);
 async function save(e:React.FormEvent){e.preventDefault();B(true);E('');N('');try{await apiService.botRequest('/admins',{phone,profileId:profile,active},'PUT');await load();N('Nomor admin tersimpan. Berlaku pada perintah berikutnya.');P('');S('');A(true)}catch(e){E((e as Error).message)}finally{B(false)}}
 return <section className="space-y-4 rounded-xl border border-slate-800 p-4"><h3 className="font-semibold">Nomor admin guru</h3><p className="text-sm text-slate-400">Nomor yang aktif dapat mencari data siswa dengan NISN dan menambah bintang/pelanggaran, termasuk di grup. Pilih akun guru aktif dari REEV Belajar untuk mencatat pelaku perubahan. Admin grup WhatsApp tidak otomatis menjadi admin bot.</p><p className="text-sm text-slate-400">Isi koneksi Supabase Belajar di Environment Variables dan jalankan SQL upgrade Belajar. Untuk grup, set BOT_GROUP_ENABLED=true. Balasan grup dapat dibaca semua anggotanya.</p>
 {error&&<p role="alert" className="text-rose-300">{error}</p>}{notice&&<p role="status" className="text-emerald-300">{notice}</p>}
 <form onSubmit={save} className="grid gap-3 sm:grid-cols-2"><label>Nomor admin<input className={cls+' block w-full'} value={phone} onChange={e=>P(e.target.value)} placeholder="628… atau 08…" required maxLength={30}/></label><label>Akun guru Belajar<select className={cls+' block w-full'} value={profile} onChange={e=>S(e.target.value)} required><option value="">Pilih guru</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{profile&&!teachers.some(t=>t.id===profile)&&<option value={profile}>Akun guru nonaktif</option>}</select></label><label><input type="checkbox" checked={active} onChange={e=>A(e.target.checked)}/> Aktif sebagai admin bot</label><button className={cls} disabled={busy}>{busy?'Memproses…':'Simpan nomor admin'}</button></form>
 <button className={cls} disabled={busy} onClick={()=>{B(true);E('');load().catch(e=>E(e.message)).finally(()=>B(false))}}>Muat ulang nomor admin</button>
 {rows.map(r=><div className={cls+' flex flex-wrap justify-between gap-3'} key={r.phone}><div>{r.name} · {r.phone}<p className="text-xs">{r.active&&r.teacher_active?'Aktif':'Nonaktif'}</p></div><button onClick={()=>{P(r.phone);S(r.profile_id);A(r.active)}}>Ubah / nonaktifkan</button></div>)}{!busy&&!error&&!rows.length&&<p>Belum ada nomor admin. Tambahkan nomor guru di atas.</p>}
 <p className="text-xs text-slate-400">Maksimal 500 akun/nomor ditampilkan. Pengaturan ini memakai daftar izin guru Belajar yang juga dapat dipakai integrasi WhatsApp lama.</p>
 </section>;
}
