import ApiError from "../utils/apiError.js";

async function applyPayment({ userId, utangPiutangId, amount, expectedTipe, db }) {
  if (amount <= 0) throw new ApiError(400, "amount must be > 0");

  if (!db) throw new Error("applyPayment requires db (pg client)");

  const { rows } = await db.query(
    `SELECT
      id as "_id",
      user_id as "userId",
      tipe,
      referensi_id as "referensiId",
      nama_pihak as "namaPihak",
      nominal_awal as "nominalAwal",
      nominal_sisa as "nominalSisa",
      tanggal_jatuh_tempo as "tanggalJatuhTempo",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
     FROM utang_piutang
     WHERE id=$1 AND user_id=$2
     FOR UPDATE`,
    [utangPiutangId, userId]
  );
  const doc = rows[0];
  if (!doc) throw new ApiError(404, "UtangPiutang not found");
  if (expectedTipe && doc.tipe !== expectedTipe) throw new ApiError(400, "UtangPiutang tipe tidak sesuai");

  const sisaBaru = Math.max(Number(doc.nominalSisa) - amount, 0);
  const status = sisaBaru === 0 ? "Lunas" : "Belum Lunas";

  const updated = await db.query(
    `UPDATE utang_piutang
     SET nominal_sisa=$3, status=$4, updated_at=now()
     WHERE id=$1 AND user_id=$2
     RETURNING
       id as "_id",
       user_id as "userId",
       tipe,
       referensi_id as "referensiId",
       nama_pihak as "namaPihak",
       nominal_awal as "nominalAwal",
       nominal_sisa as "nominalSisa",
       tanggal_jatuh_tempo as "tanggalJatuhTempo",
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [utangPiutangId, userId, sisaBaru, status]
  );

  return updated.rows[0];
}

async function revertPayment({ userId, utangPiutangId, amount, expectedTipe, db }) {
  if (amount <= 0) throw new ApiError(400, "amount must be > 0");

  if (!db) throw new Error("revertPayment requires db (pg client)");

  const { rows } = await db.query(
    `SELECT
      id as "_id",
      user_id as "userId",
      tipe,
      nominal_awal as "nominalAwal",
      nominal_sisa as "nominalSisa"
     FROM utang_piutang
     WHERE id=$1 AND user_id=$2
     FOR UPDATE`,
    [utangPiutangId, userId]
  );
  const doc = rows[0];
  if (!doc) throw new ApiError(404, "UtangPiutang not found");
  if (expectedTipe && doc.tipe !== expectedTipe) throw new ApiError(400, "UtangPiutang tipe tidak sesuai");

  const sisaBaru = Math.min(Number(doc.nominalSisa) + amount, Number(doc.nominalAwal));
  const status = sisaBaru === 0 ? "Lunas" : "Belum Lunas";

  const updated = await db.query(
    `UPDATE utang_piutang
     SET nominal_sisa=$3, status=$4, updated_at=now()
     WHERE id=$1 AND user_id=$2
     RETURNING
       id as "_id",
       user_id as "userId",
       tipe,
       referensi_id as "referensiId",
       nama_pihak as "namaPihak",
       nominal_awal as "nominalAwal",
       nominal_sisa as "nominalSisa",
       tanggal_jatuh_tempo as "tanggalJatuhTempo",
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [utangPiutangId, userId, sisaBaru, status]
  );

  return updated.rows[0];
}

export { applyPayment, revertPayment };
