import ApiError from "../utils/apiError.js";
import { getPool } from "../config/db.js";
import { newId } from "../db/index.js";

const asetSelect = `
  id as "_id",
  user_id as "userId",
  pengeluaran_id as "pengeluaranId",
  nama_aset as "namaAset",
  kategori_aset as "kategoriAset",
  harga_beli as "hargaBeli",
  umur_manfaat as "umurManfaat",
  nilai_residu as "nilaiResidu",
  tanggal_beli as "tanggalBeli",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

async function listAset(userId, query) {
  const pool = getPool();
  const where = ["user_id=$1"];
  const params = [userId];
  if (query?.year) {
    params.push(Number(query.year));
    where.push(`EXTRACT(YEAR FROM tanggal_beli) = $${params.length}`);
  }
  const res = await pool.query(
    `SELECT ${asetSelect}
     FROM aset_tetap
     WHERE ${where.join(" AND ")}
     ORDER BY tanggal_beli DESC, created_at DESC`,
    params
  );
  return res.rows;
}

async function createAset(userId, payload) {
  if (!payload) throw new ApiError(400, "Body is required");
  const required = [
    "pengeluaranId",
    "namaAset",
    "kategoriAset",
    "hargaBeli",
    "umurManfaat",
    "nilaiResidu",
    "tanggalBeli"
  ];
  for (const k of required) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === "") throw new ApiError(400, `${k} wajib`);
  }

  const pool = getPool();
  const pengeluaran = await pool.query(`SELECT id FROM pengeluaran WHERE id=$1 AND user_id=$2 LIMIT 1`, [
    payload.pengeluaranId,
    userId
  ]);
  if (!pengeluaran.rows[0]) throw new ApiError(400, "pengeluaranId tidak valid");

  const res = await pool.query(
    `INSERT INTO aset_tetap
      (id, user_id, pengeluaran_id, nama_aset, kategori_aset, harga_beli, umur_manfaat, nilai_residu, tanggal_beli)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${asetSelect}`,
    [
      newId(),
      userId,
      payload.pengeluaranId,
      payload.namaAset,
      payload.kategoriAset,
      payload.hargaBeli,
      payload.umurManfaat,
      payload.nilaiResidu,
      new Date(payload.tanggalBeli)
    ]
  );
  return res.rows[0];
}

async function deleteAset(userId, id) {
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM aset_tetap WHERE id=$1 AND user_id=$2 RETURNING id`,
    [id, userId]
  );
  if (!res.rows[0]) throw new ApiError(404, "Aset tidak ditemukan");
}

export { listAset, createAset, deleteAset };
