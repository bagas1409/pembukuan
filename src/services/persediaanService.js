import ApiError from "../utils/apiError.js";
import { getPool } from "../config/db.js";
import { newId } from "../db/index.js";

const persediaanSelect = `
  id as "_id",
  user_id as "userId",
  kategori,
  tanggal,
  supplier,
  nama_barang as "namaBarang",
  jumlah,
  nominal,
  metode_pembayaran as "metodePembayaran",
  keterangan,
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

async function createPersediaan(userId, payload) {
  if (!payload) throw new ApiError(400, "Body is required");
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO pembelian_persediaan
      (id, user_id, kategori, tanggal, supplier, nama_barang, jumlah, nominal, metode_pembayaran, keterangan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${persediaanSelect}`,
    [
      newId(),
      userId,
      payload.kategori,
      new Date(payload.tanggal),
      payload.supplier,
      payload.namaBarang,
      payload.jumlah,
      payload.nominal,
      payload.metodePembayaran,
      payload.keterangan ?? ""
    ]
  );
  return res.rows[0];
}

async function listPersediaan(userId, query) {
  const pool = getPool();
  const where = ["user_id=$1"];
  const params = [userId];
  if (query?.year) {
    params.push(Number(query.year));
    where.push(`EXTRACT(YEAR FROM tanggal) = $${params.length}`);
  }
  const res = await pool.query(
    `SELECT ${persediaanSelect}
     FROM pembelian_persediaan
     WHERE ${where.join(" AND ")}
     ORDER BY tanggal DESC, created_at DESC`,
    params
  );
  return res.rows;
}

async function deletePersediaan(userId, id) {
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM pembelian_persediaan WHERE id=$1 AND user_id=$2 RETURNING id`,
    [id, userId]
  );
  if (!res.rows[0]) throw new ApiError(404, "Persediaan tidak ditemukan");
}

export { createPersediaan, listPersediaan, deletePersediaan };
