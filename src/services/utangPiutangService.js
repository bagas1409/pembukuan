import ApiError from "../utils/apiError.js";
import { getPool } from "../config/db.js";

const utangPiutangSelect = `
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
`;

async function listUtangPiutang(userId, query) {
  const pool = getPool();
  const where = ["user_id=$1"];
  const params = [userId];
  if (query?.year) {
    params.push(Number(query.year));
    where.push(`EXTRACT(YEAR FROM tanggal_jatuh_tempo) = $${params.length}`);
  }
  const res = await pool.query(
    `SELECT ${utangPiutangSelect}
     FROM utang_piutang
     WHERE ${where.join(" AND ")}
     ORDER BY tanggal_jatuh_tempo ASC, created_at DESC`,
    params
  );
  return res.rows;
}

async function getUtangPiutangById(userId, id) {
  const pool = getPool();
  const res = await pool.query(`SELECT ${utangPiutangSelect} FROM utang_piutang WHERE id=$1 AND user_id=$2`, [id, userId]);
  const doc = res.rows[0];
  if (!doc) throw new ApiError(404, "UtangPiutang not found");
  return doc;
}

export { listUtangPiutang, getUtangPiutangById };
