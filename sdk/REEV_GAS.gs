/** REEV WA Gateway 2.7.0 — server-side only.
 * Project Settings > Script Properties:
 * REEV_GATEWAY_URL = http://103.253.244.29:3000 (sementara; gunakan HTTPS)
 * REEV_API_KEY = salin key nyata dari API & Webhook
 * REEV_DEVICE_ID = device_primary
 * REEV_ALLOW_HTTP = true hanya selama migrasi HTTPS
 * REEV_ORDER_SHEET = nama tab respons Form
 * REEV_TEST_PHONE = nomor Anda sendiri untuk tes manual
 * Jangan menaruh secret di HTML, Sheet, atau kode yang dibagikan.
 * Editor Apps Script tetap dapat mengakses Script Properties.
 */
function sendReevWA(noTujuan, isiPesan) {
  var p = PropertiesService.getScriptProperties();
  var url = (p.getProperty('REEV_GATEWAY_URL') || '').replace(/\/+$/, '');
  var key = p.getProperty('REEV_API_KEY');
  if (!key || !/^https?:\/\/[^/]+$/.test(url)) throw new Error('Isi REEV_GATEWAY_URL (tanpa /api) dan REEV_API_KEY di Script Properties.');
  if (!url.startsWith('https://') && p.getProperty('REEV_ALLOW_HTTP') !== 'true') throw new Error('Gunakan HTTPS; HTTP mengirim key tanpa enkripsi.');
  var phone = String(noTujuan || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = '62' + phone.slice(1);
  if (!/^[1-9][0-9]{7,14}$/.test(phone)) throw new Error('Nomor WhatsApp tidak valid. Simpan nomor sebagai teks.');
  try {
    var response = UrlFetchApp.fetch(url + '/api/messages/send', {
      method: 'post', contentType: 'application/json',
      headers: {Authorization: 'Bearer ' + key},
      payload: JSON.stringify({recipient:phone,message:String(isiPesan),deviceId:p.getProperty('REEV_DEVICE_ID') || 'device_primary'}),
      followRedirects: false, muteHttpExceptions: true
    });
    var code = response.getResponseCode(), body;
    try { body = JSON.parse(response.getContentText()); } catch (_) { return {success:false,error:'HTTP '+code+': respons bukan JSON. Periksa reverse proxy.'}; }
    return code >= 200 && code < 300 && body.success ? {success:true,messageId:body.messageId,status:body.status} : {success:false,error:body.error || 'HTTP '+code};
  } catch (_) { return {success:false,error:'Koneksi gagal; hasil kirim belum dapat dipastikan. Periksa log gateway sebelum mengulang.'}; }
}
function tesReevWA() {
  var phone = PropertiesService.getScriptProperties().getProperty('REEV_TEST_PHONE');
  if (!phone) throw new Error('Isi REEV_TEST_PHONE dengan nomor Anda sendiri.');
  Logger.log(JSON.stringify(sendReevWA(phone, 'Uji integrasi REEV WA Gateway dari Apps Script.')));
}
/** Installable trigger: From spreadsheet > On form submit.
 * A Timestamp, B Nama, C WhatsApp (teks), D Invoice, E Total, F Status.
 * Jangan pasang On edit sekaligus. Jangan jalankan handler ini manual.
 */
function triggerNotifikasiOrder(e) {
  if (!e || !e.range) throw new Error('Gunakan trigger spreadsheet On form submit. Untuk tes, jalankan tesReevWA.');
  var sheet=e.range.getSheet(), row=e.range.getRow();
  if (sheet.getName() !== PropertiesService.getScriptProperties().getProperty('REEV_ORDER_SHEET') || row<2) return;
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var existing=String(sheet.getRange(row,6).getValue());
    if(existing) return; // Sending/unknown/failure requires explicit human review, no blind duplicate.
    var v=sheet.getRange(row,1,1,5).getDisplayValues()[0];
    sheet.getRange(row,6).setValue('MENGIRIM'); SpreadsheetApp.flush();
    var message='Halo *'+v[1]+'*, terima kasih atas pesanan Anda.\n\nInvoice: '+v[3]+'\nTotal: '+v[4]+'\nStatus: Sedang diproses.';
    var result=sendReevWA(v[2],message);
    sheet.getRange(row,6).setValue(result.success?'DIKIRIM KE WHATSAPP ('+result.messageId+')':'PERIKSA: '+result.error);
  } finally {lock.releaseLock();}
}
