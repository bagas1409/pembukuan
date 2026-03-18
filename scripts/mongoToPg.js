import dotenv from "dotenv";
import { MongoClient } from "mongodb";

import connectDB, { closeDB, getPool } from "../src/config/db.js";
import { applySchema } from "../src/config/schema.js";

dotenv.config();

function byNameCaseInsensitive(collections, name) {
  const target = name.toLowerCase();
  return collections.find((c) => c.name.toLowerCase() === target)?.name || null;
}

function asId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.toString === "function") return value.toString();
  return String(value);
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is required (source MongoDB)");

  await connectDB();
  const pool = getPool();
  await applySchema(pool);

  const mongo = new MongoClient(mongoUri);
  await mongo.connect();
  const db = mongo.db();
  const collections = await db.listCollections().toArray();

  const col = {
    users:
      byNameCaseInsensitive(collections, "users") ||
      byNameCaseInsensitive(collections, "Users") ||
      byNameCaseInsensitive(collections, "user"),
    pemasukan:
      byNameCaseInsensitive(collections, "pemasukans") ||
      byNameCaseInsensitive(collections, "pemasukan") ||
      byNameCaseInsensitive(collections, "Pemasukan"),
    pengeluaran:
      byNameCaseInsensitive(collections, "pengeluarans") ||
      byNameCaseInsensitive(collections, "pengeluaran") ||
      byNameCaseInsensitive(collections, "Pengeluaran"),
    pembelianPersediaan:
      byNameCaseInsensitive(collections, "pembelianpersediaans") ||
      byNameCaseInsensitive(collections, "pembelianpersediaan") ||
      byNameCaseInsensitive(collections, "PembelianPersediaan"),
    utangPiutang:
      byNameCaseInsensitive(collections, "utangpiutangs") ||
      byNameCaseInsensitive(collections, "utangpiutang") ||
      byNameCaseInsensitive(collections, "UtangPiutang"),
    asetTetap:
      byNameCaseInsensitive(collections, "asettetaps") ||
      byNameCaseInsensitive(collections, "asettetap") ||
      byNameCaseInsensitive(collections, "AsetTetap")
  };

  for (const [k, v] of Object.entries(col)) {
    if (!v) throw new Error(`Mongo collection for "${k}" not found. Found: ${collections.map((c) => c.name).join(", ")}`);
  }

  const usersDocs = await db.collection(col.users).find({}).toArray();
  const pemasukanDocs = await db.collection(col.pemasukan).find({}).toArray();
  const pengeluaranDocs = await db.collection(col.pengeluaran).find({}).toArray();
  const persediaanDocs = await db.collection(col.pembelianPersediaan).find({}).toArray();
  const utangPiutangDocs = await db.collection(col.utangPiutang).find({}).toArray();
  const asetDocs = await db.collection(col.asetTetap).find({}).toArray();

  console.log("Mongo counts:", {
    users: usersDocs.length,
    pemasukan: pemasukanDocs.length,
    pengeluaran: pengeluaranDocs.length,
    pembelianPersediaan: persediaanDocs.length,
    utangPiutang: utangPiutangDocs.length,
    asetTetap: asetDocs.length
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const u of usersDocs) {
      await client.query(
        `INSERT INTO users (id, nama_usaha, email, password, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           nama_usaha=EXCLUDED.nama_usaha,
           email=EXCLUDED.email,
           password=EXCLUDED.password,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [asId(u._id), u.namaUsaha, (u.email || "").toLowerCase(), u.password, asDate(u.createdAt), asDate(u.updatedAt)]
      );
    }

    for (const p of pemasukanDocs) {
      await client.query(
        `INSERT INTO pemasukan
          (id, user_id, kategori, tanggal, nomor_invoice, nama_customer, nominal_total, nominal_diskon, metode_pembayaran, tanggal_jatuh_tempo, keterangan, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           kategori=EXCLUDED.kategori,
           tanggal=EXCLUDED.tanggal,
           nomor_invoice=EXCLUDED.nomor_invoice,
           nama_customer=EXCLUDED.nama_customer,
           nominal_total=EXCLUDED.nominal_total,
           nominal_diskon=EXCLUDED.nominal_diskon,
           metode_pembayaran=EXCLUDED.metode_pembayaran,
           tanggal_jatuh_tempo=EXCLUDED.tanggal_jatuh_tempo,
           keterangan=EXCLUDED.keterangan,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [
          asId(p._id),
          asId(p.userId),
          p.kategori,
          asDate(p.tanggal),
          p.nomorInvoice,
          p.namaCustomer,
          p.nominalTotal,
          p.nominalDiskon ?? 0,
          p.metodePembayaran,
          asDate(p.tanggalJatuhTempo),
          p.keterangan ?? "",
          asDate(p.createdAt),
          asDate(p.updatedAt)
        ]
      );
    }

    for (const pe of pengeluaranDocs) {
      await client.query(
        `INSERT INTO pengeluaran
          (id, user_id, kategori, sub_kategori, tanggal, nama_vendor_penerima, nominal, metode_pembayaran, tanggal_jatuh_tempo, referensi_utang_id, keterangan, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           kategori=EXCLUDED.kategori,
           sub_kategori=EXCLUDED.sub_kategori,
           tanggal=EXCLUDED.tanggal,
           nama_vendor_penerima=EXCLUDED.nama_vendor_penerima,
           nominal=EXCLUDED.nominal,
           metode_pembayaran=EXCLUDED.metode_pembayaran,
           tanggal_jatuh_tempo=EXCLUDED.tanggal_jatuh_tempo,
           referensi_utang_id=EXCLUDED.referensi_utang_id,
           keterangan=EXCLUDED.keterangan,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [
          asId(pe._id),
          asId(pe.userId),
          pe.kategori,
          pe.subKategori,
          asDate(pe.tanggal),
          pe.namaVendorPenerima,
          pe.nominal,
          pe.metodePembayaran,
          asDate(pe.tanggalJatuhTempo),
          asId(pe.referensiUtangId),
          pe.keterangan ?? "",
          asDate(pe.createdAt),
          asDate(pe.updatedAt)
        ]
      );
    }

    for (const pb of persediaanDocs) {
      await client.query(
        `INSERT INTO pembelian_persediaan
          (id, user_id, kategori, tanggal, supplier, nama_barang, jumlah, nominal, metode_pembayaran, keterangan, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           kategori=EXCLUDED.kategori,
           tanggal=EXCLUDED.tanggal,
           supplier=EXCLUDED.supplier,
           nama_barang=EXCLUDED.nama_barang,
           jumlah=EXCLUDED.jumlah,
           nominal=EXCLUDED.nominal,
           metode_pembayaran=EXCLUDED.metode_pembayaran,
           keterangan=EXCLUDED.keterangan,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [
          asId(pb._id),
          asId(pb.userId),
          pb.kategori,
          asDate(pb.tanggal),
          pb.supplier,
          pb.namaBarang,
          pb.jumlah,
          pb.nominal,
          pb.metodePembayaran,
          pb.keterangan ?? "",
          asDate(pb.createdAt),
          asDate(pb.updatedAt)
        ]
      );
    }

    for (const up of utangPiutangDocs) {
      await client.query(
        `INSERT INTO utang_piutang
          (id, user_id, tipe, referensi_id, nama_pihak, nominal_awal, nominal_sisa, tanggal_jatuh_tempo, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           tipe=EXCLUDED.tipe,
           referensi_id=EXCLUDED.referensi_id,
           nama_pihak=EXCLUDED.nama_pihak,
           nominal_awal=EXCLUDED.nominal_awal,
           nominal_sisa=EXCLUDED.nominal_sisa,
           tanggal_jatuh_tempo=EXCLUDED.tanggal_jatuh_tempo,
           status=EXCLUDED.status,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [
          asId(up._id),
          asId(up.userId),
          up.tipe,
          asId(up.referensiId),
          up.namaPihak,
          up.nominalAwal,
          up.nominalSisa,
          asDate(up.tanggalJatuhTempo),
          up.status,
          asDate(up.createdAt),
          asDate(up.updatedAt)
        ]
      );
    }

    for (const a of asetDocs) {
      await client.query(
        `INSERT INTO aset_tetap
          (id, user_id, pengeluaran_id, nama_aset, kategori_aset, harga_beli, umur_manfaat, nilai_residu, tanggal_beli, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           pengeluaran_id=EXCLUDED.pengeluaran_id,
           nama_aset=EXCLUDED.nama_aset,
           kategori_aset=EXCLUDED.kategori_aset,
           harga_beli=EXCLUDED.harga_beli,
           umur_manfaat=EXCLUDED.umur_manfaat,
           nilai_residu=EXCLUDED.nilai_residu,
           tanggal_beli=EXCLUDED.tanggal_beli,
           created_at=EXCLUDED.created_at,
           updated_at=EXCLUDED.updated_at`,
        [
          asId(a._id),
          asId(a.userId),
          asId(a.pengeluaranId),
          a.namaAset,
          a.kategoriAset,
          a.hargaBeli,
          a.umurManfaat,
          a.nilaiResidu,
          asDate(a.tanggalBeli),
          asDate(a.createdAt),
          asDate(a.updatedAt)
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Migration completed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await mongo.close();
  }
}

main()
  .catch((err) => {
    console.error("Mongo→Postgres migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB();
  });

