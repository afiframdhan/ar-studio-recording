# Update Price List AR Studio Recording

Price list telah disinkronkan dengan data terbaru AR Studio Music Production.

## Data aktif
- Overdub Recording — Rp150.000/jam; Rp360.000/1/2 shift (3 jam); Rp600.000/shift (5 jam)
- Aransemen MIDI / Instrumen — Rp850.000; Rp1.200.000; Rp1.600.000
- Jingle — Rp3.500.000 atau Rp5.500.000
- Paket Video Cover — Rp800.000
- Mixing — Rp350.000 sampai Rp1.000.000 berdasarkan jumlah track
- Mastering — Rp300.000–Rp500.000/lagu
- Booking WhatsApp — 0857-2209-6345

## Apps Script
File `apps-script/Code.gs` adalah backend lengkap terbaru. Fungsi tambahan `updateArStudioPriceList()` dapat dijalankan kapan saja untuk mengisi ulang sheet `PriceList` dengan data harga resmi di atas.

## Booking dari kartu harga
`js/app.js` sudah diperbaiki agar layanan baru yang belum ada di sheet `Services` tetap otomatis terpilih di form booking ketika tombol Booking dari kartu harga ditekan.
