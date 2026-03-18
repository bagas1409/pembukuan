import ApiError from "../utils/apiError.js";
import { applyPayment, revertPayment } from "./utangPiutangHelpers.js";
import { getPool } from "../config/db.js";
import { newId, withTransaction } from "../db/index.js";

const pengeluaranSelect = `
  id as "_id",
  user_id as "userId",
  kategori,
  sub_kategori as "subKategori",
  tanggal,
  nama_vendor_penerima as "namaVendorPenerima",
  nominal,
  metode_pembayaran as "metodePembayaran",
  tanggal_jatuh_tempo as "tanggalJatuhTempo",
  referensi_utang_id as "referensiUtangId",
  keterangan,
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

function validateAsetPayload(aset) {
  if (!aset) throw new ApiError(400, "aset wajib untuk kategori = Pembelian Aset");
  const required = ["namaAset", "kategoriAset", "hargaBeli", "umurManfaat", "nilaiResidu", "tanggalBeli"];
  for (const k of required) {
    if (aset[k] === undefined || aset[k] === null || aset[k] === "") throw new ApiError(400, `aset.${k} wajib`);
  }
}

function normalizeSubKategori(value) {
  if (typeof value !== "string") return "Lainnya";
  const v = value.trim();
  return v ? v : "Lainnya";
}

async function createPengeluaran(userId, payload) {
  const { aset, ...pengeluaranPayload } = payload || {};
  const data = { ...pengeluaranPayload, userId };

  data.subKategori = normalizeSubKategori(data.subKategori);

  if (data.metodePembayaran === "Hutang" && !data.tanggalJatuhTempo) {
    throw new ApiError(400, "tanggalJatuhTempo wajib jika metodePembayaran = Hutang");
  }

  if (data.kategori === "Pembayaran Utang" && !data.referensiUtangId) {
    throw new ApiError(400, "referensiUtangId wajib jika kategori = Pembayaran Utang");
  }

  if (data.kategori === "Pembelian Aset") {
    validateAsetPayload(aset);
  }

  return withTransaction(async (db) => {
    const id = newId();
    const pengeluaranRes = await db.query(
      `INSERT INTO pengeluaran
        (id, user_id, kategori, sub_kategori, tanggal, nama_vendor_penerima, nominal, metode_pembayaran, tanggal_jatuh_tempo, referensi_utang_id, keterangan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${pengeluaranSelect}`,
      [
        id,
        userId,
        data.kategori,
        data.subKategori,
        new Date(data.tanggal),
        data.namaVendorPenerima,
        data.nominal,
        data.metodePembayaran,
        data.tanggalJatuhTempo ? new Date(data.tanggalJatuhTempo) : null,
        data.referensiUtangId ?? null,
        data.keterangan ?? ""
      ]
    );
    const pengeluaran = pengeluaranRes.rows[0];

    if (pengeluaran.metodePembayaran === "Hutang") {
      await db.query(
        `INSERT INTO utang_piutang
          (id, user_id, tipe, referensi_id, nama_pihak, nominal_awal, nominal_sisa, tanggal_jatuh_tempo, status)
         VALUES ($1,$2,'Utang',$3,$4,$5,$6,$7,'Belum Lunas')`,
        [
          newId(),
          userId,
          pengeluaran._id,
          pengeluaran.namaVendorPenerima,
          pengeluaran.nominal,
          pengeluaran.nominal,
          pengeluaran.tanggalJatuhTempo
        ]
      );
    }

    if (pengeluaran.kategori === "Pembelian Aset") {
      await db.query(
        `INSERT INTO aset_tetap
          (id, user_id, pengeluaran_id, nama_aset, kategori_aset, harga_beli, umur_manfaat, nilai_residu, tanggal_beli)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(),
          userId,
          pengeluaran._id,
          aset.namaAset,
          aset.kategoriAset,
          aset.hargaBeli,
          aset.umurManfaat,
          aset.nilaiResidu,
          new Date(aset.tanggalBeli)
        ]
      );
    }

    if (pengeluaran.kategori === "Pembayaran Utang") {
      const target = await db.query(`SELECT id FROM utang_piutang WHERE id=$1 AND user_id=$2 AND tipe='Utang' LIMIT 1`, [
        pengeluaran.referensiUtangId,
        userId
      ]);
      if (!target.rows[0]) throw new ApiError(400, "referensiUtangId tidak valid");
      await applyPayment({
        userId,
        utangPiutangId: pengeluaran.referensiUtangId,
        amount: Number(pengeluaran.nominal),
        expectedTipe: "Utang",
        db
      });
    }

    return pengeluaran;
  });
}

async function listPengeluaran(userId, query) {
  const pool = getPool();
  const where = ["user_id=$1"];
  const params = [userId];
  if (query?.year) {
    params.push(Number(query.year));
    where.push(`EXTRACT(YEAR FROM tanggal) = $${params.length}`);
  }
  const res = await pool.query(
    `SELECT ${pengeluaranSelect}
     FROM pengeluaran
     WHERE ${where.join(" AND ")}
     ORDER BY tanggal DESC, created_at DESC`,
    params
  );
  return res.rows;
}

async function updatePengeluaran(userId, id, payload) {
  const { aset, ...pengeluaranPayload } = payload || {};
  const allowed = [
    "kategori",
    "subKategori",
    "tanggal",
    "namaVendorPenerima",
    "nominal",
    "metodePembayaran",
    "tanggalJatuhTempo",
    "referensiUtangId",
    "keterangan"
  ];
  const next = Object.fromEntries(
    Object.entries(pengeluaranPayload || {}).filter(([k, v]) => allowed.includes(k) && v !== undefined)
  );

  return withTransaction(async (db) => {
    const existingRes = await db.query(
      `SELECT ${pengeluaranSelect} FROM pengeluaran WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [id, userId]
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new ApiError(404, "Pengeluaran not found");

    if (existing.kategori === "Pembayaran Utang") {
      throw new ApiError(400, "Update untuk kategori Pembayaran Utang tidak didukung");
    }

    const upRes = await db.query(
      `SELECT id as "_id", nominal_awal as "nominalAwal", nominal_sisa as "nominalSisa"
       FROM utang_piutang
       WHERE user_id=$1 AND tipe='Utang' AND referensi_id=$2
       FOR UPDATE`,
      [userId, existing._id]
    );
    const utangPiutang = upRes.rows[0] || null;

    const asetRes = await db.query(
      `SELECT id as "_id" FROM aset_tetap WHERE user_id=$1 AND pengeluaran_id=$2 FOR UPDATE`,
      [userId, existing._id]
    );
    const asetExisting = asetRes.rows[0] || null;

    const merged = {
      kategori: next.kategori ?? existing.kategori,
      subKategori: normalizeSubKategori(next.subKategori ?? existing.subKategori),
      tanggal: next.tanggal ?? existing.tanggal,
      namaVendorPenerima: next.namaVendorPenerima ?? existing.namaVendorPenerima,
      nominal: next.nominal ?? existing.nominal,
      metodePembayaran: next.metodePembayaran ?? existing.metodePembayaran,
      tanggalJatuhTempo: next.tanggalJatuhTempo ?? existing.tanggalJatuhTempo,
      referensiUtangId: next.referensiUtangId ?? existing.referensiUtangId,
      keterangan: next.keterangan ?? existing.keterangan
    };

    if (merged.metodePembayaran === "Hutang" && !merged.tanggalJatuhTempo) {
      throw new ApiError(400, "tanggalJatuhTempo wajib jika metodePembayaran = Hutang");
    }
    if (merged.kategori === "Pembelian Aset") {
      validateAsetPayload(aset);
    }

    const updatedRes = await db.query(
      `UPDATE pengeluaran
       SET kategori=$3,
           sub_kategori=$4,
           tanggal=$5,
           nama_vendor_penerima=$6,
           nominal=$7,
           metode_pembayaran=$8,
           tanggal_jatuh_tempo=$9,
           referensi_utang_id=$10,
           keterangan=$11,
           updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING ${pengeluaranSelect}`,
      [
        id,
        userId,
        merged.kategori,
        merged.subKategori,
        new Date(merged.tanggal),
        merged.namaVendorPenerima,
        merged.nominal,
        merged.metodePembayaran,
        merged.tanggalJatuhTempo ? new Date(merged.tanggalJatuhTempo) : null,
        merged.referensiUtangId ?? null,
        merged.keterangan ?? ""
      ]
    );
    const updated = updatedRes.rows[0];

    const nowHutang = updated.metodePembayaran === "Hutang";
    if (utangPiutang && !nowHutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      if (paid > 0) throw new ApiError(400, "Tidak bisa ubah dari Hutang karena sudah ada pembayaran");
      await db.query(`DELETE FROM utang_piutang WHERE id=$1 AND user_id=$2`, [utangPiutang._id, userId]);
    }

    if (!utangPiutang && nowHutang) {
      await db.query(
        `INSERT INTO utang_piutang
          (id, user_id, tipe, referensi_id, nama_pihak, nominal_awal, nominal_sisa, tanggal_jatuh_tempo, status)
         VALUES ($1,$2,'Utang',$3,$4,$5,$6,$7,'Belum Lunas')`,
        [
          newId(),
          userId,
          updated._id,
          updated.namaVendorPenerima,
          updated.nominal,
          updated.nominal,
          updated.tanggalJatuhTempo
        ]
      );
    }

    if (utangPiutang && nowHutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      const nominalSisa = Math.max(Number(updated.nominal) - paid, 0);
      const status = nominalSisa === 0 ? "Lunas" : "Belum Lunas";
      await db.query(
        `UPDATE utang_piutang
         SET nama_pihak=$3,
             nominal_awal=$4,
             nominal_sisa=$5,
             tanggal_jatuh_tempo=$6,
             status=$7,
             updated_at=now()
         WHERE id=$1 AND user_id=$2`,
        [utangPiutang._id, userId, updated.namaVendorPenerima, updated.nominal, nominalSisa, updated.tanggalJatuhTempo, status]
      );
    }

    const nowAset = updated.kategori === "Pembelian Aset";
    if (asetExisting && !nowAset) {
      await db.query(`DELETE FROM aset_tetap WHERE id=$1 AND user_id=$2`, [asetExisting._id, userId]);
    }
    if (!asetExisting && nowAset) {
      await db.query(
        `INSERT INTO aset_tetap
          (id, user_id, pengeluaran_id, nama_aset, kategori_aset, harga_beli, umur_manfaat, nilai_residu, tanggal_beli)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(),
          userId,
          updated._id,
          aset.namaAset,
          aset.kategoriAset,
          aset.hargaBeli,
          aset.umurManfaat,
          aset.nilaiResidu,
          new Date(aset.tanggalBeli)
        ]
      );
    }
    if (asetExisting && nowAset) {
      await db.query(
        `UPDATE aset_tetap
         SET nama_aset=$3,
             kategori_aset=$4,
             harga_beli=$5,
             umur_manfaat=$6,
             nilai_residu=$7,
             tanggal_beli=$8,
             updated_at=now()
         WHERE id=$1 AND user_id=$2`,
        [
          asetExisting._id,
          userId,
          aset.namaAset,
          aset.kategoriAset,
          aset.hargaBeli,
          aset.umurManfaat,
          aset.nilaiResidu,
          new Date(aset.tanggalBeli)
        ]
      );
    }

    return updated;
  });
}

async function deletePengeluaran(userId, id) {
  return withTransaction(async (db) => {
    const existingRes = await db.query(
      `SELECT ${pengeluaranSelect} FROM pengeluaran WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [id, userId]
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new ApiError(404, "Pengeluaran not found");

    if (existing.kategori === "Pembayaran Utang") {
      await revertPayment({
        userId,
        utangPiutangId: existing.referensiUtangId,
        amount: Number(existing.nominal),
        expectedTipe: "Utang",
        db
      });
      await db.query(`DELETE FROM pengeluaran WHERE id=$1 AND user_id=$2`, [id, userId]);
      return;
    }

    const upRes = await db.query(
      `SELECT id as "_id", nominal_awal as "nominalAwal", nominal_sisa as "nominalSisa"
       FROM utang_piutang
       WHERE user_id=$1 AND tipe='Utang' AND referensi_id=$2
       FOR UPDATE`,
      [userId, existing._id]
    );
    const utangPiutang = upRes.rows[0] || null;
    if (utangPiutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      if (paid > 0) throw new ApiError(400, "Tidak bisa hapus Hutang karena sudah ada pembayaran");
      await db.query(`DELETE FROM utang_piutang WHERE id=$1 AND user_id=$2`, [utangPiutang._id, userId]);
    }

    await db.query(`DELETE FROM aset_tetap WHERE user_id=$1 AND pengeluaran_id=$2`, [userId, existing._id]);
    await db.query(`DELETE FROM pengeluaran WHERE id=$1 AND user_id=$2`, [id, userId]);
  });
}

export {
  createPengeluaran,
  listPengeluaran,
  updatePengeluaran,
  deletePengeluaran
};
