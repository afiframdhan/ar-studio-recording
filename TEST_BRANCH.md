# AR Studio — Apple-inspired UI Test

Versi ini dibuat untuk diuji di branch `test` sebelum dipindahkan ke `main`.

Yang berubah:
- seluruh visual UI/UX (home + semua subpage)
- typography memakai system font Apple-style (`-apple-system` / SF Pro fallback)
- navigation translucent / blur
- section, cards, portfolio, price list, gallery, booking, footer, modal diperbarui
- Google Drive audio tetap menggunakan popup preview player
- cache-busting asset dinaikkan ke `v=8`

Yang tidak berubah:
- Apps Script API
- struktur Spreadsheet
- booking backend
- data portfolio
- URL deployment Apps Script

Tes branch `test` terlebih dahulu. Setelah disetujui, merge `test` ke `main`.
