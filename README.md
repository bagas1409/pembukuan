# Akutansi Backend (Express + PostgreSQL)

## Setup

1. Buat database di PostgreSQL (mis. `akutansi`)
2. Set `DATABASE_URL` di `backend/.env`
3. Install deps: `npm i` (di folder `backend`)
4. Apply schema: `npm run db:init`
5. Run: `npm run dev`

## Migrasi dari MongoDB (one-time)

1. Isi `MONGO_URI` di `backend/.env` (source MongoDB)
2. Pastikan `DATABASE_URL` mengarah ke database PostgreSQL target
3. Jalankan: `npm run db:mongo-to-pg`

Dokumentasi lengkap: `backend/DOCUMENTATION.md`

## Auth

### POST `/auth/register`

Request:
```json
{ "namaUsaha": "Toko Maju", "email": "owner@tokomaju.com", "password": "secret123" }
```

Response (201):
```json
{ "token": "<jwt>", "user": { "id": "<userId>", "namaUsaha": "Toko Maju", "email": "owner@tokomaju.com" } }
```

### POST `/auth/login`

Request:
```json
{ "email": "owner@tokomaju.com", "password": "secret123" }
```

Response (200):
```json
{ "token": "<jwt>", "user": { "id": "<userId>", "namaUsaha": "Toko Maju", "email": "owner@tokomaju.com" } }
```

### GET `/auth/me`

Header:
```json
{ "Authorization": "Bearer <jwt>" }
```

Response (200):
```json
{ "user": { "id": "<userId>", "namaUsaha": "Toko Maju", "email": "owner@tokomaju.com", "createdAt": "2026-03-11T00:00:00.000Z" } }
```

## Pemasukan

### POST `/pemasukan` (Piutang → auto buat `UtangPiutang` tipe `Piutang`)

Request:
```json
{
  "kategori": "Penjualan",
  "tanggal": "2026-03-11",
  "nomorInvoice": "INV-001",
  "namaCustomer": "Budi",
  "nominalTotal": 1000000,
  "nominalDiskon": 0,
  "metodePembayaran": "Piutang",
  "tanggalJatuhTempo": "2026-04-11",
  "keterangan": "Penjualan kredit"
}
```

Response (201):
```json
{ "data": { "_id": "<pemasukanId>", "userId": "<userId>", "kategori": "Penjualan" } }
```

### POST `/pemasukan` (Pelunasan Piutang → auto potong `nominalSisa`)

Request:
```json
{
  "kategori": "Pelunasan Piutang",
  "tanggal": "2026-03-20",
  "nomorInvoice": "INV-001",
  "namaCustomer": "Budi",
  "nominalTotal": 250000,
  "nominalDiskon": 0,
  "metodePembayaran": "Transfer",
  "keterangan": "Cicilan 1"
}
```

Response (201):
```json
{ "data": { "_id": "<pemasukanPelunasanId>", "kategori": "Pelunasan Piutang", "nomorInvoice": "INV-001" } }
```

## Pengeluaran

### POST `/pengeluaran` (Hutang → auto buat `UtangPiutang` tipe `Utang`)

Request:
```json
{
  "kategori": "Beban Operasional",
  "subKategori": "Beban Sewa",
  "tanggal": "2026-03-11",
  "namaVendorPenerima": "PT Sewa",
  "nominal": 2000000,
  "metodePembayaran": "Hutang",
  "tanggalJatuhTempo": "2026-04-11",
  "keterangan": "Sewa ruko"
}
```

Response (201):
```json
{ "data": { "_id": "<pengeluaranId>", "metodePembayaran": "Hutang" } }
```

### POST `/pengeluaran` (Pembayaran Utang → auto potong `nominalSisa`)

Request:
```json
{
  "kategori": "Pembayaran Utang",
  "subKategori": "Beban Lain-lain",
  "tanggal": "2026-03-25",
  "namaVendorPenerima": "PT Sewa",
  "nominal": 500000,
  "metodePembayaran": "Transfer",
  "referensiUtangId": "<utangPiutangId>",
  "keterangan": "Bayar sebagian"
}
```

Response (201):
```json
{ "data": { "_id": "<pengeluaranBayarId>", "kategori": "Pembayaran Utang", "referensiUtangId": "<utangPiutangId>" } }
```

### POST `/pengeluaran` (Pembelian Aset → auto buat `AsetTetap`)

Request:
```json
{
  "kategori": "Pembelian Aset",
  "subKategori": "Beban Lain-lain",
  "tanggal": "2026-03-11",
  "namaVendorPenerima": "Dealer Mobil",
  "nominal": 150000000,
  "metodePembayaran": "Transfer",
  "keterangan": "Beli kendaraan operasional",
  "aset": {
    "namaAset": "Mobil Operasional",
    "kategoriAset": "Kendaraan",
    "hargaBeli": 150000000,
    "umurManfaat": 5,
    "nilaiResidu": 20000000,
    "tanggalBeli": "2026-03-11"
  }
}
```

Response (201):
```json
{ "data": { "_id": "<pengeluaranAsetId>", "kategori": "Pembelian Aset" } }
```

## Persediaan

### POST `/persediaan`

Request:
```json
{
  "kategori": "Pembelian Barang",
  "tanggal": "2026-03-11",
  "supplier": "PT Supplier",
  "namaBarang": "Produk A",
  "jumlah": 10,
  "nominal": 500000,
  "metodePembayaran": "Tunai",
  "keterangan": ""
}
```

Response (201):
```json
{ "data": { "_id": "<persediaanId>", "kategori": "Pembelian Barang" } }
```

## Laporan

### GET `/laporan/laba-rugi?start=2026-01-01&end=2026-12-31`

Response (200):
```json
{ "data": { "ringkasan": { "labaKotor": 0, "labaBersih": 0 } } }
```

### GET `/laporan/neraca`

Response (200):
```json
{ "data": { "aktiva": { "totalAktiva": 0 }, "pasiva": { "totalPasiva": 0 } } }
```

### GET `/laporan/dashboard?year=2026`

Response (200):
```json
{ "data": { "year": 2026, "totalPenjualan": 0, "totalPembelian": 0, "utangAktif": 0, "piutangAktif": 0, "totalAset": 0 } }
```

