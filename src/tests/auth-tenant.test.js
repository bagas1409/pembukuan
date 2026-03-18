import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../app.js";
import { getPool } from "../config/db.js";
import { setupTestDb, resetTestDb, teardownTestDb } from "./testDb.js";

async function registerAndToken({ email, namaUsaha = "Toko", password = "secret123" }) {
  const res = await request(app).post("/auth/register").send({ namaUsaha, email, password });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.ok(res.body.user?.id);
  return { token: res.body.token, userId: res.body.user.id };
}

before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
  process.env.JWT_EXPIRES_IN = "7d";
  await setupTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});

after(async () => {
  await teardownTestDb();
});

test("Protected endpoints require JWT", async () => {
  const res = await request(app).get("/pemasukan");
  assert.equal(res.status, 401);
});

test("Tenant isolation: user B cannot read user A data", async () => {
  const a = await registerAndToken({ email: "a@test.com", namaUsaha: "A" });
  const b = await registerAndToken({ email: "b@test.com", namaUsaha: "B" });

  const create = await request(app)
    .post("/pemasukan")
    .set("Authorization", `Bearer ${a.token}`)
    .send({
      kategori: "Penjualan",
      tanggal: "2026-03-11",
      nomorInvoice: "INV-001",
      namaCustomer: "Customer A",
      nominalTotal: 100000,
      nominalDiskon: 0,
      metodePembayaran: "Tunai",
      keterangan: ""
    });
  assert.equal(create.status, 201);
  const pemasukanId = create.body.data?._id;
  assert.ok(pemasukanId);

  const listB = await request(app).get("/pemasukan").set("Authorization", `Bearer ${b.token}`);
  assert.equal(listB.status, 200);
  assert.equal(Array.isArray(listB.body.data), true);
  assert.equal(listB.body.data.length, 0);

  const getB = await request(app).get(`/pemasukan/${pemasukanId}`).set("Authorization", `Bearer ${b.token}`);
  assert.equal(getB.status, 404);
});

test("Auto UtangPiutang (Piutang) is created with same userId", async () => {
  const a = await registerAndToken({ email: "a@test.com", namaUsaha: "A" });

  const create = await request(app)
    .post("/pemasukan")
    .set("Authorization", `Bearer ${a.token}`)
    .send({
      kategori: "Penjualan",
      tanggal: "2026-03-11",
      nomorInvoice: "INV-PIUTANG-1",
      namaCustomer: "Customer A",
      nominalTotal: 250000,
      nominalDiskon: 0,
      metodePembayaran: "Piutang",
      tanggalJatuhTempo: "2026-04-11",
      keterangan: ""
    });
  assert.equal(create.status, 201);

  const pool = getPool();
  const upRes = await pool.query(
    `SELECT nominal_awal as "nominalAwal", nominal_sisa as "nominalSisa", status
     FROM utang_piutang
     WHERE user_id=$1 AND tipe='Piutang'
     LIMIT 1`,
    [a.userId]
  );
  const up = upRes.rows[0];
  assert.ok(up);
  assert.equal(up.nominalAwal, 250000);
  assert.equal(up.nominalSisa, 250000);
  assert.equal(up.status, "Belum Lunas");
});
