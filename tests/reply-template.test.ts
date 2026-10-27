import test from 'node:test';import assert from 'node:assert/strict';import {profileTemplate,exampleReply,renderReply,validateTemplate} from '../src/shared/reply-template.js';
test('profile template formats real fields, missing scores, leading zero NISN and zero tasks',()=>{
const r=renderReply('belajar.profile',profileTemplate,exampleReply);assert.match(r,/HAI, SISWA CONTOH/);assert.match(r,/90,40/);assert.match(r,/Nilai ujian: Belum tersedia/);assert.match(r,/1 tugas/);assert.match(r,/selesaikan tugasmu/);
assert.equal(renderReply('belajar.profile','{nisn}',exampleReply),'0012345678');assert.match(renderReply('belajar.profile',profileTemplate,exampleReply.replace('Belum selesai: 1','Belum selesai: 0')),/Semua tugas sudah selesai/);
});
test('errors, unknown schema and long output retain original; instructions cannot be omitted',()=>{
assert.equal(renderReply('belajar.profile',profileTemplate,'Akses ditolak',false),'Akses ditolak');assert.equal(renderReply('belajar.profile',profileTemplate,'new schema'),'new schema');assert.throws(()=>validateTemplate('belajar.profile','{unknown}'));assert.throws(()=>validateTemplate('belajar.register','Sukses!'));assert.equal(renderReply('belajar.register','🌸\n{pesan_asli}','Balas YA dalam 5 menit'),'🌸\nBalas YA dalam 5 menit');assert.equal(renderReply('belajar.tasks','{pesan_asli}{pesan_asli}','x'.repeat(8000)),'x'.repeat(8000));
});
