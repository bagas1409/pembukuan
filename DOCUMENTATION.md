# Dokumentasi Backend Akuntansi Multi-User

## Tech Stack

- Node.js + Express
- PostgreSQL (`pg`)
- JWT (Authorization: `Bearer <JWT>`)
- bcrypt (hash password)

## Menjalankan Server

1. Buat database PostgreSQL (mis. `akutansi`)
2. Set `DATABASE_URL` di `backend/.env`
3. Di folder `backend`: `npm i`
4. Apply schema: `npm run db:init`
5. Dev (auto-reload): `npm run dev`
6. Prod: `npm start`

## Migrasi dari MongoDB (one-time)

1. Isi `MONGO_URI` di `backend/.env` (source MongoDB)
2. Pastikan `DATABASE_URL` mengarah ke database PostgreSQL target
3. Apply schema (jika belum): `npm run db:init`
4. Jalankan: `npm run db:mongo-to-pg`

## Unit Test (Keamanan Data/Tenant Isolation)

1. Install deps: `npm i`
2. Jalankan: `npm test`

Test memakai `pg-mem` (PostgreSQL in-memory), jadi tidak butuh PostgreSQL lokal untuk test.

## Env Vars

- `PORT`
- `DATABASE_URL` (atau `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`)
- `MONGO_URI` (opsional, hanya untuk migrasi)
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

## Keamanan & Tenant Isolation

- Semua endpoint transaksi + laporan memakai `authMiddleware`.
- Semua query data transaksi selalu filter `userId = req.user.id` (di SQL: `user_id = $1`).

## Endpoints

### AUTH

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### PEMASUKAN

- `POST /pemasukan`
- `GET /pemasukan`
- `GET /pemasukan/:id`
- `PUT /pemasukan/:id`
- `DELETE /pemasukan/:id`

### PENGELUARAN

- `POST /pengeluaran`
- `GET /pengeluaran`
- `PUT /pengeluaran/:id`
- `DELETE /pengeluaran/:id`

### PERSEDIAAN

- `POST /persediaan`
- `GET /persediaan`

### ASET

- `GET /aset`
- `POST /aset`

### UTANG PIUTANG

- `GET /utang-piutang`
- `GET /utang-piutang/:id`

### LAPORAN

- `GET /laporan/laba-rugi?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /laporan/neraca?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /laporan/dashboard?year=YYYY`

## Logic Otomatis (Service Layer)

1. `Pemasukan.metodePembayaran = "Piutang"` → auto create `UtangPiutang` (`tipe="Piutang"`).
2. `Pengeluaran.metodePembayaran = "Hutang"` → auto create `UtangPiutang` (`tipe="Utang"`).
3. `Pengeluaran.kategori = "Pembelian Aset"` → auto create `AsetTetap` (butuh payload `aset`).
4. Pelunasan:
   - `Pemasukan.kategori = "Pelunasan Piutang"` → auto kurangi `UtangPiutang.nominalSisa` (berdasarkan `nomorInvoice` piutang).
   - `Pengeluaran.kategori = "Pembayaran Utang"` + `referensiUtangId` → auto kurangi `nominalSisa`.

## Contoh JSON

Lihat `backend/README.md`.

