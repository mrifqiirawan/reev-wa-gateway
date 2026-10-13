type Row = { status: string; errorCode?: string; errorMessage?: string; statusUpdatedAt?: string };
const rank: Record<string, number> = { queued: 0, sending: 1, failed: 1, sent: 2, delivered: 3, read: 4 };
export function advanceReceipt(row: Row, status: 'delivered' | 'read'): boolean {
  if ((rank[row.status] ?? 0) >= rank[status]) return false;
  row.status = status;
  delete row.errorCode; delete row.errorMessage;
  row.statusUpdatedAt = new Date().toISOString();
  return true;
}
export function failSend(row: Row, code: string, message: string): boolean {
  if (row.status === 'delivered' || row.status === 'read') return false;
  row.status = 'failed'; row.errorCode = code; row.errorMessage = message;
  row.statusUpdatedAt = new Date().toISOString();
  return true;
}
export function finishSend(row: Row): void {
  // An asynchronous NACK may arrive before sendMessage resolves.
  if (row.status === 'sending' || row.status === 'queued') row.status = 'sent';
}
export function explainFailure(code: string): string {
  if (code === '463') return 'WhatsApp menolak pengiriman: akun dibatasi atau token privasi kontak belum tersedia. Periksa pembatasan akun di aplikasi WhatsApp; jangan ulangi kirim berkali-kali.';
  if (code === '479') return 'WhatsApp menolak alamat atau sesi perangkat (479). Sambungkan ulang gateway, lalu uji satu pesan setelah memeriksa nomor.';
  return 'WhatsApp melaporkan penolakan pengiriman (kode ' + code + '). Periksa akun pengirim dan nomor tujuan sebelum mencoba ulang.';
}
