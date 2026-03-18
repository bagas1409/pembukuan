import ApiError from "../utils/apiError.js";
import { applyPayment, revertPayment } from "./utangPiutangHelpers.js";
import { getPool } from "../config/db.js";
import { newId, withTransaction } from "../db/index.js";

const pemasukanSelect = `
  id as "_id",
  user_id as "userId",
  kategori,
  tanggal,
  nomor_invoice as "nomorInvoice",
  nama_customer as "namaCustomer",
  nominal_total as "nominalTotal",
  nominal_diskon as "nominalDiskon",
  metode_pembayaran as "metodePembayaran",
  tanggal_jatuh_tempo as "tanggalJatuhTempo",
  keterangan,
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

async function findTargetPiutangPemasukanId(db, { userId, nomorInvoice }) {
  const target = await db.query(
    `SELECT id
     FROM pemasukan
     WHERE user_id=$1 AND nomor_invoice=$2 AND metode_pembayaran='Piutang'
     ORDER BY tanggal DESC, created_at DESC
     LIMIT 1`,
    [userId, nomorInvoice]
  );
  return target.rows[0]?.id || null;
}

async function findUtangPiutangIdByReferensi(db, { userId, tipe, referensiId }) {
  const res = await db.query(
    `SELECT id FROM utang_piutang WHERE user_id=$1 AND tipe=$2 AND referensi_id=$3 LIMIT 1`,
    [userId, tipe, referensiId]
  );
  return res.rows[0]?.id || null;
}

async function createPemasukan(userId, payload) {
  const data = { ...payload, userId };

  if (data.metodePembayaran === "Piutang" && !data.tanggalJatuhTempo) {
    throw new ApiError(400, "tanggalJatuhTempo wajib jika metodePembayaran = Piutang");
  }

  let utangPiutangIdToPay = null;
  return withTransaction(async (db) => {
    if (data.kategori === "Pelunasan Piutang") {
      const targetPemasukanId = await findTargetPiutangPemasukanId(db, { userId, nomorInvoice: data.nomorInvoice });
      if (!targetPemasukanId) throw new ApiError(400, "nomorInvoice tidak ditemukan untuk Piutang");

      const utangPiutangId = await findUtangPiutangIdByReferensi(db, {
        userId,
        tipe: "Piutang",
        referensiId: targetPemasukanId
      });
      if (!utangPiutangId) throw new ApiError(400, "UtangPiutang Piutang tidak ditemukan untuk nomorInvoice tsb");
      utangPiutangIdToPay = utangPiutangId;
    }

    const id = newId();
    const pemasukanRes = await db.query(
      `INSERT INTO pemasukan
        (id, user_id, kategori, tanggal, nomor_invoice, nama_customer, nominal_total, nominal_diskon, metode_pembayaran, tanggal_jatuh_tempo, keterangan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${pemasukanSelect}`,
      [
        id,
        userId,
        data.kategori,
        new Date(data.tanggal),
        data.nomorInvoice,
        data.namaCustomer,
        data.nominalTotal,
        data.nominalDiskon ?? 0,
        data.metodePembayaran,
        data.tanggalJatuhTempo ? new Date(data.tanggalJatuhTempo) : null,
        data.keterangan ?? ""
      ]
    );
    const pemasukan = pemasukanRes.rows[0];

    if (pemasukan.metodePembayaran === "Piutang") {
      await db.query(
        `INSERT INTO utang_piutang
          (id, user_id, tipe, referensi_id, nama_pihak, nominal_awal, nominal_sisa, tanggal_jatuh_tempo, status)
         VALUES ($1,$2,'Piutang',$3,$4,$5,$6,$7,'Belum Lunas')`,
        [newId(), userId, pemasukan._id, pemasukan.namaCustomer, pemasukan.nominalTotal, pemasukan.nominalTotal, pemasukan.tanggalJatuhTempo]
      );
    }

    if (utangPiutangIdToPay) {
      await applyPayment({
        userId,
        utangPiutangId: utangPiutangIdToPay,
        amount: pemasukan.nominalTotal,
        expectedTipe: "Piutang",
        db
      });
    }

    return pemasukan;
  });
}

async function listPemasukan(userId, query) {
  const pool = getPool();
  const where = ["user_id=$1"];
  const params = [userId];
  if (query?.year) {
    params.push(Number(query.year));
    where.push(`EXTRACT(YEAR FROM tanggal) = $${params.length}`);
  }
  const res = await pool.query(
    `SELECT ${pemasukanSelect}
     FROM pemasukan
     WHERE ${where.join(" AND ")}
     ORDER BY tanggal DESC, created_at DESC`,
    params
  );
  return res.rows;
}

async function getPemasukanById(userId, id) {
  const pool = getPool();
  const res = await pool.query(`SELECT ${pemasukanSelect} FROM pemasukan WHERE id=$1 AND user_id=$2`, [id, userId]);
  const doc = res.rows[0];
  if (!doc) throw new ApiError(404, "Pemasukan not found");
  return doc;
}

async function updatePemasukan(userId, id, payload) {
  const allowed = [
    "kategori",
    "tanggal",
    "nomorInvoice",
    "namaCustomer",
    "nominalTotal",
    "nominalDiskon",
    "metodePembayaran",
    "tanggalJatuhTempo",
    "keterangan"
  ];
  const next = Object.fromEntries(Object.entries(payload || {}).filter(([k, v]) => allowed.includes(k) && v !== undefined));

  return withTransaction(async (db) => {
    const existingRes = await db.query(`SELECT ${pemasukanSelect} FROM pemasukan WHERE id=$1 AND user_id=$2 FOR UPDATE`, [
      id,
      userId
    ]);
    const existing = existingRes.rows[0];
    if (!existing) throw new ApiError(404, "Pemasukan not found");

    if (existing.kategori === "Pelunasan Piutang") {
      throw new ApiError(400, "Update untuk kategori Pelunasan Piutang tidak didukung");
    }

    const upRes = await db.query(
      `SELECT id as "_id", nominal_awal as "nominalAwal", nominal_sisa as "nominalSisa"
       FROM utang_piutang
       WHERE user_id=$1 AND tipe='Piutang' AND referensi_id=$2
       FOR UPDATE`,
      [userId, existing._id]
    );
    const utangPiutang = upRes.rows[0] || null;

    const merged = {
      kategori: next.kategori ?? existing.kategori,
      tanggal: next.tanggal ?? existing.tanggal,
      nomorInvoice: next.nomorInvoice ?? existing.nomorInvoice,
      namaCustomer: next.namaCustomer ?? existing.namaCustomer,
      nominalTotal: next.nominalTotal ?? existing.nominalTotal,
      nominalDiskon: next.nominalDiskon ?? existing.nominalDiskon,
      metodePembayaran: next.metodePembayaran ?? existing.metodePembayaran,
      tanggalJatuhTempo: next.tanggalJatuhTempo ?? existing.tanggalJatuhTempo,
      keterangan: next.keterangan ?? existing.keterangan
    };

    if (merged.metodePembayaran === "Piutang" && !merged.tanggalJatuhTempo) {
      throw new ApiError(400, "tanggalJatuhTempo wajib jika metodePembayaran = Piutang");
    }

    const updatedRes = await db.query(
      `UPDATE pemasukan
       SET kategori=$3,
           tanggal=$4,
           nomor_invoice=$5,
           nama_customer=$6,
           nominal_total=$7,
           nominal_diskon=$8,
           metode_pembayaran=$9,
           tanggal_jatuh_tempo=$10,
           keterangan=$11,
           updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING ${pemasukanSelect}`,
      [
        id,
        userId,
        merged.kategori,
        new Date(merged.tanggal),
        merged.nomorInvoice,
        merged.namaCustomer,
        merged.nominalTotal,
        merged.nominalDiskon ?? 0,
        merged.metodePembayaran,
        merged.tanggalJatuhTempo ? new Date(merged.tanggalJatuhTempo) : null,
        merged.keterangan ?? ""
      ]
    );
    const updated = updatedRes.rows[0];

    const nowPiutang = updated.metodePembayaran === "Piutang";

    if (utangPiutang && !nowPiutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      if (paid > 0) throw new ApiError(400, "Tidak bisa ubah dari Piutang karena sudah ada pelunasan");
      await db.query(`DELETE FROM utang_piutang WHERE id=$1 AND user_id=$2`, [utangPiutang._id, userId]);
    }

    if (!utangPiutang && nowPiutang) {
      await db.query(
        `INSERT INTO utang_piutang
          (id, user_id, tipe, referensi_id, nama_pihak, nominal_awal, nominal_sisa, tanggal_jatuh_tempo, status)
         VALUES ($1,$2,'Piutang',$3,$4,$5,$6,$7,'Belum Lunas')`,
        [newId(), userId, updated._id, updated.namaCustomer, updated.nominalTotal, updated.nominalTotal, updated.tanggalJatuhTempo]
      );
    }

    if (utangPiutang && nowPiutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      const nominalSisa = Math.max(Number(updated.nominalTotal) - paid, 0);
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
        [utangPiutang._id, userId, updated.namaCustomer, updated.nominalTotal, nominalSisa, updated.tanggalJatuhTempo, status]
      );
    }

    return updated;
  });
}

async function deletePemasukan(userId, id) {
  return withTransaction(async (db) => {
    const existingRes = await db.query(`SELECT ${pemasukanSelect} FROM pemasukan WHERE id=$1 AND user_id=$2 FOR UPDATE`, [
      id,
      userId
    ]);
    const existing = existingRes.rows[0];
    if (!existing) throw new ApiError(404, "Pemasukan not found");

    if (existing.kategori === "Pelunasan Piutang") {
      const targetPemasukanId = await findTargetPiutangPemasukanId(db, {
        userId,
        nomorInvoice: existing.nomorInvoice
      });
      if (targetPemasukanId) {
        const utangPiutangId = await findUtangPiutangIdByReferensi(db, {
          userId,
          tipe: "Piutang",
          referensiId: targetPemasukanId
        });
        if (utangPiutangId) {
          await revertPayment({
            userId,
            utangPiutangId,
            amount: Number(existing.nominalTotal),
            expectedTipe: "Piutang",
            db
          });
        }
      }

      await db.query(`DELETE FROM pemasukan WHERE id=$1 AND user_id=$2`, [id, userId]);
      return;
    }

    const upRes = await db.query(
      `SELECT id as "_id", nominal_awal as "nominalAwal", nominal_sisa as "nominalSisa"
       FROM utang_piutang
       WHERE user_id=$1 AND tipe='Piutang' AND referensi_id=$2
       FOR UPDATE`,
      [userId, existing._id]
    );
    const utangPiutang = upRes.rows[0] || null;
    if (utangPiutang) {
      const paid = Number(utangPiutang.nominalAwal) - Number(utangPiutang.nominalSisa);
      if (paid > 0) throw new ApiError(400, "Tidak bisa hapus Piutang karena sudah ada pelunasan");
      await db.query(`DELETE FROM utang_piutang WHERE id=$1 AND user_id=$2`, [utangPiutang._id, userId]);
    }

    await db.query(`DELETE FROM pemasukan WHERE id=$1 AND user_id=$2`, [id, userId]);
  });
}

export {
  createPemasukan,
  listPemasukan,
  getPemasukanById,
  updatePemasukan,
  deletePemasukan
};
