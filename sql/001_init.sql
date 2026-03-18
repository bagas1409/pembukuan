BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nama_usaha TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pemasukan (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL,
  tanggal TIMESTAMPTZ NOT NULL,
  nomor_invoice TEXT NOT NULL,
  nama_customer TEXT NOT NULL,
  nominal_total NUMERIC NOT NULL,
  nominal_diskon NUMERIC NOT NULL DEFAULT 0,
  metode_pembayaran TEXT NOT NULL,
  tanggal_jatuh_tempo TIMESTAMPTZ NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pemasukan_user_id_idx ON pemasukan(user_id);
CREATE INDEX IF NOT EXISTS pemasukan_user_invoice_idx ON pemasukan(user_id, nomor_invoice);

CREATE TABLE IF NOT EXISTS pengeluaran (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL,
  sub_kategori TEXT NOT NULL,
  tanggal TIMESTAMPTZ NOT NULL,
  nama_vendor_penerima TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  metode_pembayaran TEXT NOT NULL,
  tanggal_jatuh_tempo TIMESTAMPTZ NULL,
  referensi_utang_id TEXT NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pengeluaran_user_id_idx ON pengeluaran(user_id);

CREATE TABLE IF NOT EXISTS pembelian_persediaan (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL,
  tanggal TIMESTAMPTZ NOT NULL,
  supplier TEXT NOT NULL,
  nama_barang TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  nominal NUMERIC NOT NULL,
  metode_pembayaran TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pembelian_persediaan_user_id_idx ON pembelian_persediaan(user_id);

CREATE TABLE IF NOT EXISTS utang_piutang (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL,
  referensi_id TEXT NOT NULL,
  nama_pihak TEXT NOT NULL,
  nominal_awal NUMERIC NOT NULL,
  nominal_sisa NUMERIC NOT NULL,
  tanggal_jatuh_tempo TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS utang_piutang_user_id_idx ON utang_piutang(user_id);
CREATE INDEX IF NOT EXISTS utang_piutang_user_tipe_status_idx ON utang_piutang(user_id, tipe, status);
CREATE INDEX IF NOT EXISTS utang_piutang_referensi_idx ON utang_piutang(user_id, tipe, referensi_id);

CREATE TABLE IF NOT EXISTS aset_tetap (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pengeluaran_id TEXT NOT NULL REFERENCES pengeluaran(id) ON DELETE CASCADE,
  nama_aset TEXT NOT NULL,
  kategori_aset TEXT NOT NULL,
  harga_beli NUMERIC NOT NULL,
  umur_manfaat INTEGER NOT NULL,
  nilai_residu NUMERIC NOT NULL,
  tanggal_beli TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aset_tetap_user_id_idx ON aset_tetap(user_id);
CREATE INDEX IF NOT EXISTS aset_tetap_pengeluaran_id_idx ON aset_tetap(pengeluaran_id);

COMMIT;

