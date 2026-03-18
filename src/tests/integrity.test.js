import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../app.js";
import { setupTestDb, resetTestDb, teardownTestDb } from "./testDb.js";

async function registerAndToken({ email, namaUsaha = "Toko", password = "secret123" }) {
  const res = await request(app).post("/auth/register").send({ namaUsaha, email, password });
  assert.equal(res.status, 201);
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

test("User B cannot pay User A utang (referensiUtangId isolation)", async () => {
  const a = await registerAndToken({ email: "a@test.com", namaUsaha: "A" });
  const b = await registerAndToken({ email: "b@test.com", namaUsaha: "B" });

  const hutang = await request(app)
    .post("/pengeluaran")
    .set("Authorization", `Bearer ${a.token}`)
    .send({
      kategori: "Beban Operasional",
      subKategori: "Beban Sewa",
      tanggal: "2026-03-11",
      namaVendorPenerima: "Vendor A",
      nominal: 1000000,
      metodePembayaran: "Hutang",
      tanggalJatuhTempo: "2026-04-11",
      keterangan: ""
    });
  assert.equal(hutang.status, 201);

  const listUpA = await request(app).get("/utang-piutang").set("Authorization", `Bearer ${a.token}`);
  assert.equal(listUpA.status, 200);
  const utangA = listUpA.body.data.find((x) => x.tipe === "Utang");
  assert.ok(utangA?._id);

  const payAsB = await request(app)
    .post("/pengeluaran")
    .set("Authorization", `Bearer ${b.token}`)
    .send({
      kategori: "Pembayaran Utang",
      subKategori: "Bunga",
      tanggal: "2026-03-20",
      namaVendorPenerima: "Vendor A",
      nominal: 100000,
      metodePembayaran: "Transfer",
      referensiUtangId: utangA._id,
      keterangan: ""
    });
  assert.equal(payAsB.status, 400);
});

test("POST /aset rejects pengeluaranId that does not belong to user", async () => {
  const a = await registerAndToken({ email: "a@test.com", namaUsaha: "A" });
  const b = await registerAndToken({ email: "b@test.com", namaUsaha: "B" });

  const pengeluaranAsetA = await request(app)
    .post("/pengeluaran")
    .set("Authorization", `Bearer ${a.token}`)
    .send({
      kategori: "Pembelian Aset",
      subKategori: "Bunga",
      tanggal: "2026-03-11",
      namaVendorPenerima: "Dealer",
      nominal: 5000000,
      metodePembayaran: "Transfer",
      keterangan: "",
      aset: {
        namaAset: "Komputer",
        kategoriAset: "Peralatan Kantor",
        hargaBeli: 5000000,
        umurManfaat: 3,
        nilaiResidu: 500000,
        tanggalBeli: "2026-03-11"
      }
    });
  assert.equal(pengeluaranAsetA.status, 201);
  const pengeluaranId = pengeluaranAsetA.body.data._id;
  assert.ok(pengeluaranId);

  const createAsetByB = await request(app)
    .post("/aset")
    .set("Authorization", `Bearer ${b.token}`)
    .send({
      pengeluaranId,
      namaAset: "Komputer",
      kategoriAset: "Peralatan Kantor",
      hargaBeli: 5000000,
      umurManfaat: 3,
      nilaiResidu: 500000,
      tanggalBeli: "2026-03-11"
    });
  assert.equal(createAsetByB.status, 400);
});
