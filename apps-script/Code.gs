/**
 * AR Studio Recording — API backend untuk GitHub Pages
 * Spreadsheet tetap menjadi database utama.
 */

const APP = {
  name: 'AR Studio Recording',
  databaseProperty: 'AR_STUDIO_DATABASE_ID',
  databaseName: 'AR Studio Website Database',
  sheets: {
    Settings: ['key', 'value'],
    Services: ['id', 'title', 'description', 'icon', 'sortOrder', 'active'],
    AudioPortfolio: ['id', 'title', 'artist', 'coverUrl', 'audioUrl', 'duration', 'sortOrder', 'active'],
    VideoPortfolio: ['id', 'title', 'subtitle', 'youtubeId', 'thumbnailUrl', 'sortOrder', 'active'],
    PriceList: ['id', 'service', 'price', 'unit', 'features', 'sortOrder', 'active', 'description', 'details', 'notes'],
    Gallery: ['id', 'title', 'imageUrl', 'sortOrder', 'active', 'category'],
    Bookings: ['timestamp', 'bookingId', 'name', 'whatsapp', 'service', 'date', 'time', 'notes', 'status']
  }
};

/** GET dipakai GitHub Pages untuk mengambil data website. */
function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || 'data').toLowerCase();
    if (action !== 'data') return apiOutput_({ success: false, message: 'Action tidak dikenal.' }, e);

    const section = String(e && e.parameter && e.parameter.section || 'home').toLowerCase();
    const allowed = ['home', 'portfolio', 'prices', 'services', 'gallery', 'about'];
    const safeSection = allowed.indexOf(section) > -1 ? section : 'home';
    const cache = CacheService.getScriptCache();
    const cacheKey = 'website:' + safeSection + ':v3';
    const cached = cache.get(cacheKey);
    if (cached) return apiOutput_({ success: true, data: JSON.parse(cached), cached: true }, e);

    const data = getWebsiteData(safeSection);
    try { cache.put(cacheKey, JSON.stringify(data), 120); } catch (ignore) {}
    return apiOutput_({ success: true, data: data, cached: false }, e);
  } catch (err) {
    return apiOutput_({ success: false, message: err && err.message ? err.message : String(err) }, e);
  }
}

/** POST dipakai form booking di GitHub Pages. */
function doPost(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || 'booking').toLowerCase();
    if (action !== 'booking') return jsonOutput_({ success: false, message: 'Action tidak dikenal.' });

    let payload = Object.assign({}, e && e.parameter || {});
    if (e && e.postData && e.postData.type && e.postData.type.indexOf('application/json') > -1) {
      payload = JSON.parse(e.postData.contents || '{}');
    }
    return jsonOutput_(submitBooking(payload));
  } catch (err) {
    return jsonOutput_({ success: false, message: err && err.message ? err.message : String(err) });
  }
}

function apiOutput_(payload, e) {
  const prefix = String(e && e.parameter && e.parameter.prefix || '');
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // JSONP membuat data GET bisa dipanggil langsung dari GitHub Pages tanpa masalah CORS.
  if (prefix && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(prefix)) {
    return ContentService.createTextOutput(prefix + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupDatabase() {
  const ss = getDatabase_();
  Object.keys(APP.sheets).forEach(function(name) {
    ensureSheet_(ss, name, APP.sheets[name]);
  });
  formatDatabase_(ss);
  return { id: ss.getId(), name: ss.getName(), url: ss.getUrl() };
}

function getDatabaseInfo() {
  const ss = getDatabase_();
  return { id: ss.getId(), name: ss.getName(), url: ss.getUrl() };
}

function getWebsiteData(section) {
  const ss = getDatabase_();
  Object.keys(APP.sheets).forEach(function(name) {
    ensureSheet_(ss, name, APP.sheets[name]);
  });

  const settings = settingsObject_(readObjects_(ss, 'Settings'));
  const data = { settings: settings };

  if (section === 'home') {
    data.services = activeSorted_(readObjects_(ss, 'Services')).slice(0, 5);
    data.audio = activeSorted_(readObjects_(ss, 'AudioPortfolio')).slice(0, 3);
    data.videos = activeSorted_(readObjects_(ss, 'VideoPortfolio')).slice(0, 2);
    data.prices = activeSorted_(readObjects_(ss, 'PriceList')).slice(0, 5);
    data.gallery = activeSorted_(readObjects_(ss, 'Gallery')).slice(0, 6);
  } else if (section === 'portfolio') {
    data.audio = activeSorted_(readObjects_(ss, 'AudioPortfolio'));
    data.videos = activeSorted_(readObjects_(ss, 'VideoPortfolio'));
  } else if (section === 'prices') {
    data.prices = activeSorted_(readObjects_(ss, 'PriceList'));
  } else if (section === 'services') {
    data.services = activeSorted_(readObjects_(ss, 'Services'));
  } else if (section === 'gallery') {
    data.gallery = activeSorted_(readObjects_(ss, 'Gallery'));
  }

  return data;
}

function submitBooking(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Data booking tidak valid.');
  const clean = {
    name: sanitize_(payload.name, 80),
    whatsapp: sanitize_(payload.whatsapp, 30),
    service: sanitize_(payload.service, 60),
    date: sanitize_(payload.date, 20),
    time: sanitize_(payload.time, 20),
    notes: sanitize_(payload.notes, 500)
  };
  if (!clean.name || !clean.whatsapp || !clean.service || !clean.date || !clean.time) {
    throw new Error('Mohon lengkapi nama, WhatsApp, layanan, tanggal, dan jam.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getDatabase_();
    ensureSheet_(ss, 'Bookings', APP.sheets.Bookings);
    const sheet = ss.getSheetByName('Bookings');
    const bookingId = 'ARS-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    sheet.appendRow([new Date(), bookingId, clean.name, clean.whatsapp, clean.service, clean.date, clean.time, clean.notes, 'Baru']);
    return { success: true, bookingId: bookingId, message: 'Booking berhasil dikirim.' };
  } finally {
    lock.releaseLock();
  }
}

function getDatabase_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(APP.databaseProperty);
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (err) {
      throw new Error('Database tersimpan tidak dapat diakses. Periksa izin Spreadsheet.');
    }
  }

  // Jika Apps Script dibuat dari Extensions > Apps Script pada Spreadsheet AR Studio,
  // Spreadsheet aktif ini otomatis dipakai sebagai database.
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Spreadsheet database belum terhubung. Jalankan script dari Spreadsheet AR Studio atau set Script Property AR_STUDIO_DATABASE_ID.');
  props.setProperty(APP.databaseProperty, active.getId());
  return active;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0];
    headers.forEach(function(header, i) {
      if (!current[i]) sheet.getRange(1, i + 1).setValue(header);
    });
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function formatDatabase_(ss) {
  Object.keys(APP.sheets).forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const cols = APP.sheets[name].length;
    sheet.getRange(1, 1, 1, cols).setBackground('#f97316').setFontColor('#ffffff').setFontWeight('bold');
    sheet.autoResizeColumns(1, cols);
    sheet.getDataRange().setVerticalAlignment('middle');
  });
  const bookingSheet = ss.getSheetByName('Bookings');
  if (bookingSheet) bookingSheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function readObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift();
  return values.filter(function(row) { return row.some(String); }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, i) { obj[header] = row[i]; });
    return obj;
  });
}

function activeSorted_(items) {
  return items.filter(function(item) {
    return !('active' in item) || ['true', 'ya', '1', 'aktif'].indexOf(String(item.active).toLowerCase()) > -1;
  }).sort(function(a, b) {
    return Number(a.sortOrder || 999) - Number(b.sortOrder || 999);
  });
}

function settingsObject_(rows) {
  return rows.reduce(function(out, row) {
    if (row.key) out[row.key] = row.value;
    return out;
  }, {});
}

function sanitize_(value, max) {
  return String(value == null ? '' : value).trim().replace(/[<>]/g, '').slice(0, max);
}

/**
 * Memasukkan / memperbarui price list resmi AR Studio tanpa mengubah sheet lain.
 * Jalankan sekali dari Apps Script bila data PriceList perlu di-reset ke harga ini.
 */
function updateArStudioPriceList() {
  const ss = getDatabase_();
  const sheet = ensureSheet_(ss, 'PriceList', APP.sheets.PriceList);
  const rows = [
    ['PRC-01', 'Overdub Recording', 'Rp150.000', '/ jam', 'Rp360.000 / 1/2 shift (3 jam)|Rp600.000 / shift (5 jam)', 1, true, 'Layanan overdub recording untuk vocal maupun instrumen dengan pilihan durasi per jam, setengah shift, atau full shift.', 'Rp150.000 / jam|Rp360.000 / 1/2 shift (3 jam)|Rp600.000 / shift (5 jam)', 'Booking via WhatsApp: 0857-2209-6345'],
    ['PRC-02', 'Aransemen MIDI / Instrumen', 'Rp850.000', 'mulai', 'No Mixing|Mixing & Mastering Basic|Take Vocal / Edit Vocal', 2, true, 'Paket aransemen MIDI/instrumen dari produksi dasar sampai paket lengkap dengan take dan editing vocal.', 'Rp850.000 — No Mixing|Rp1.200.000 — Mixing & Mastering Basic|Rp1.600.000 — Take Vocal/Edit Vocal & Mixing Mastering Basic', 'Detail kebutuhan aransemen dan referensi musik dapat dibahas saat booking.'],
    ['PRC-03', 'Jingle', 'Rp3.500.000', 'mulai', 'Aransemen musik|Membuat nada & lirik', 3, true, 'Produksi jingle untuk brand, sekolah, bisnis, campaign, atau kebutuhan promosi.', 'Rp3.500.000 — Aransemen Musik|Rp5.500.000 — Membuat Nada & Lirik', 'Brief, durasi, penggunaan komersial, dan referensi gaya musik dibahas sebelum produksi.'],
    ['PRC-04', 'Paket Video Cover', 'Rp800.000', '/ paket', 'Take vocal|3 angle video indoor|Editing video|Mixing & mastering', 4, true, 'Paket produksi video cover indoor dengan proses take vocal, tiga angle video, editing, mixing, dan mastering.', 'Musik disiapkan sendiri|Take vocal setengah shift (3 jam)|3 angle video indoor|Editing Video + Mixing + Mastering', 'Musik / backing track disiapkan sendiri oleh client.'],
    ['PRC-05', 'Mixing', 'Rp350.000', 'mulai', 'Vocal editing|Vocal tuning basic|Timing correction|EQ|Compression|Reverb & Delay|Stereo imaging|Automation|Vocal & instrumental balancing|Mix bus processing|Final mix WAV + MP3|2x revisi', 5, true, 'Mixing multitrack lengkap dengan editing dasar, balancing, processing, automation, dan final mix.', 'Rp350.000 — 1–10 Track|Rp500.000 — 11–20 Track|Rp700.000 — 21–50 Track|Rp1.000.000 — >50 Track|Vocal editing|Vocal tuning basic|Timing correction|EQ|Compression|Reverb & Delay|Stereo imaging|Automation|Vocal & instrumental balancing|Mix bus processing|Final mix WAV + MP3|2x revisi', 'Harga mengikuti jumlah track pada project.'],
    ['PRC-06', 'Mastering', 'Rp300.000–500.000', '/ lagu', 'EQ tonal balancing|Compression|Limiting|Stereo enhancement|Loudness optimization|Dynamic control|Streaming optimization|WAV Master|MP3 Master', 6, true, 'Finalisasi audio agar tonal balance, dinamika, loudness, dan format akhir siap untuk distribusi.', 'EQ tonal balancing|Compression|Limiting|Stereo enhancement|Loudness optimization|Dynamic control|Streaming optimization|WAV Master|MP3 Master', 'Harga Rp300.000–Rp500.000 per lagu, menyesuaikan kebutuhan materi.']
  ];

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, APP.sheets.PriceList.length).clearContent();
  }
  sheet.getRange(2, 1, rows.length, APP.sheets.PriceList.length).setValues(rows);

  const settingsSheet = ensureSheet_(ss, 'Settings', APP.sheets.Settings);
  const settings = readObjects_(ss, 'Settings');
  const rowMap = {};
  settings.forEach(function(row, index) { if (row.key) rowMap[row.key] = index + 2; });
  if (rowMap.phone) settingsSheet.getRange(rowMap.phone, 2).setValue('085722096345');
  if (rowMap.whatsapp) settingsSheet.getRange(rowMap.whatsapp, 2).setValue('6285722096345');

  formatDatabase_(ss);
  try { CacheService.getScriptCache().removeAll(['website:home:v3', 'website:prices:v3']); } catch (ignore) {}
  return { success: true, updated: rows.length, sheet: 'PriceList' };
}
