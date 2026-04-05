import { getPool } from "../config/db.js";

function parseRange(query) {
  const start = query.start ? new Date(query.start) : null;
  const end = query.end ? new Date(query.end) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  return validStart || validEnd ? { start: validStart, end: validEnd } : null;
}

async function labaRugi(userId, query) {
  const pool = getPool();
  const range = parseRange(query || {});

  const pemasukanWhere = ["user_id=$1"];
  const pemasukanParams = [userId];
  if (range?.start) {
    pemasukanParams.push(range.start);
    pemasukanWhere.push(`tanggal >= $${pemasukanParams.length}`);
  }
  if (range?.end) {
    pemasukanParams.push(range.end);
    pemasukanWhere.push(`tanggal <= $${pemasukanParams.length}`);
  }

  const pemasukanAgg = await pool.query(
    `SELECT kategori, COALESCE(SUM(nominal_total), 0) as total
     FROM pemasukan
     WHERE ${pemasukanWhere.join(" AND ")}
     GROUP BY kategori`,
    pemasukanParams
  );
  const pemasukanMap = Object.fromEntries(pemasukanAgg.rows.map((r) => [r.kategori, r.total]));
  const penjualan = pemasukanMap["Penjualan"] || 0;
  const returPenjualan = pemasukanMap["Retur Penjualan"] || 0;
  const potonganPenjualan = pemasukanMap["Potongan Penjualan"] || 0;
  const pendapatanBersih = penjualan - returPenjualan - potonganPenjualan;

  const persediaanAgg = await pool.query(
    `SELECT kategori, COALESCE(SUM(nominal), 0) as total
     FROM pembelian_persediaan
     WHERE ${pemasukanWhere.join(" AND ")}
     GROUP BY kategori`,
    pemasukanParams
  );
  const persediaanMap = Object.fromEntries(persediaanAgg.rows.map((r) => [r.kategori, r.total]));

  const persediaanAwal = persediaanMap["Persediaan Awal"] || 0;
  const pembelianBarang = persediaanMap["Pembelian Barang"] || 0;
  const returPembelian = persediaanMap["Retur Pembelian"] || 0;
  const potonganPembelian = persediaanMap["Potongan Pembelian"] || 0;
  const ongkosAngkut = persediaanMap["Ongkos Angkut"] || 0;
  const persediaanAkhir = persediaanMap["Persediaan Akhir"] || 0;
  const hpp =
    persediaanAwal + pembelianBarang + ongkosAngkut - returPembelian - potonganPembelian - persediaanAkhir;

  const bebanAgg = await pool.query(
    `SELECT kategori, COALESCE(SUM(nominal), 0) as total
     FROM pengeluaran
     WHERE ${pemasukanWhere.join(" AND ")}
     GROUP BY kategori`,
    pemasukanParams
  );
  const bebanMap = Object.fromEntries(bebanAgg.rows.map((r) => [r.kategori, r.total]));
  const bebanOperasional = bebanMap["Beban Operasional"] || 0;
  const bebanLain = bebanMap["Beban Lain-lain"] || 0;
  const prive = bebanMap["Prive"] || 0;

  const labaKotor = pendapatanBersih - hpp;
  const totalBeban = bebanOperasional + bebanLain;
  const labaBersih = labaKotor - totalBeban;

  return {
    pendapatan: { penjualan, returPenjualan, potonganPenjualan, pendapatanBersih },
    hpp: { persediaanAwal, pembelianBarang, ongkosAngkut, returPembelian, potonganPembelian, persediaanAkhir, hpp },
    beban: { bebanOperasional, bebanLain, prive, totalBeban },
    ringkasan: { labaKotor, labaBersih }
  };
}

async function neraca(userId, query) {
  const pool = getPool();
  const range = parseRange(query || {});

  const pemasukanWhere = ["user_id=$1", `metode_pembayaran IN ('Tunai','Transfer')`];
  const pengeluaranWhere = ["user_id=$1", `metode_pembayaran IN ('Tunai','Transfer')`];
  const params = [userId];
  if (range?.start) {
    params.push(range.start);
    pemasukanWhere.push(`tanggal >= $${params.length}`);
    pengeluaranWhere.push(`tanggal >= $${params.length}`);
  }
  if (range?.end) {
    params.push(range.end);
    pemasukanWhere.push(`tanggal <= $${params.length}`);
    pengeluaranWhere.push(`tanggal <= $${params.length}`);
  }

  const kasMasuk = await pool.query(
    `SELECT COALESCE(SUM(nominal_total), 0) as total FROM pemasukan WHERE ${pemasukanWhere.join(" AND ")}`,
    params
  );
  const kasKeluar = await pool.query(
    `SELECT COALESCE(SUM(nominal), 0) as total FROM pengeluaran WHERE ${pengeluaranWhere.join(" AND ")}`,
    params
  );
  const kasBank = (kasMasuk.rows[0]?.total || 0) - (kasKeluar.rows[0]?.total || 0);

  const piutang = await pool.query(
    `SELECT COALESCE(SUM(nominal_sisa), 0) as total
     FROM utang_piutang
     WHERE user_id=$1 AND tipe='Piutang' AND status='Belum Lunas'`,
    [userId]
  );
  const utang = await pool.query(
    `SELECT COALESCE(SUM(nominal_sisa), 0) as total
     FROM utang_piutang
     WHERE user_id=$1 AND tipe='Utang' AND status='Belum Lunas'`,
    [userId]
  );

  const asetTetap = await pool.query(`SELECT COALESCE(SUM(harga_beli), 0) as total FROM aset_tetap WHERE user_id=$1`, [
    userId
  ]);

  const persediaanWhere = ["user_id=$1", `kategori='Persediaan Akhir'`];
  const persediaanParams = [userId];
  if (range?.start) {
    persediaanParams.push(range.start);
    persediaanWhere.push(`tanggal >= $${persediaanParams.length}`);
  }
  if (range?.end) {
    persediaanParams.push(range.end);
    persediaanWhere.push(`tanggal <= $${persediaanParams.length}`);
  }

  const persediaanAkhir = await pool.query(
    `SELECT nominal, tanggal
     FROM pembelian_persediaan
     WHERE ${persediaanWhere.join(" AND ")}
     ORDER BY tanggal DESC, created_at DESC
     LIMIT 1`,
    persediaanParams
  );
  const nilaiPersediaan = persediaanAkhir.rows[0]?.nominal || 0;

  const totalAktiva = kasBank + (piutang.rows[0]?.total || 0) + nilaiPersediaan + (asetTetap.rows[0]?.total || 0);
  const totalKewajiban = utang.rows[0]?.total || 0;
  const ekuitas = totalAktiva - totalKewajiban;

  return {
    aktiva: {
      kasBank,
      piutangUsaha: piutang.rows[0]?.total || 0,
      persediaan: nilaiPersediaan,
      asetTetap: asetTetap.rows[0]?.total || 0,
      totalAktiva
    },
    pasiva: {
      utangUsaha: utang.rows[0]?.total || 0,
      ekuitas,
      totalPasiva: totalKewajiban + ekuitas
    }
  };
}

async function dashboard(userId, query) {
  const pool = getPool();
  const year = query?.year ? Number(query.year) : null;
  const range = parseRange(query || {});

  const pemasukanWhere = ["user_id=$1"];
  const pengeluaranWhere = ["user_id=$1"];
  const params = [userId];

  if (year) {
    params.push(year);
    pemasukanWhere.push(`EXTRACT(YEAR FROM tanggal) = $${params.length}`);
    pengeluaranWhere.push(`EXTRACT(YEAR FROM tanggal) = $${params.length}`);
  }

  if (range?.start) {
    params.push(range.start);
    pemasukanWhere.push(`tanggal >= $${params.length}`);
    pengeluaranWhere.push(`tanggal >= $${params.length}`);
  }
  if (range?.end) {
    params.push(range.end);
    pemasukanWhere.push(`tanggal <= $${params.length}`);
    pengeluaranWhere.push(`tanggal <= $${params.length}`);
  }

  // Pemasukan = all from pemasukan table
  const totalPenjualan = await pool.query(
    `SELECT COALESCE(SUM(nominal_total), 0) as total FROM pemasukan WHERE ${pemasukanWhere.join(" AND ")}`,
    params
  );

  // Pengeluaran = from pengeluaran + pembelian_persediaan
  const totalPengeluaranRow = await pool.query(
    `SELECT COALESCE(SUM(nominal), 0) as total FROM pengeluaran WHERE ${pengeluaranWhere.join(" AND ")}`,
    params
  );
  const totalPembelianPersediaan = await pool.query(
    `SELECT COALESCE(SUM(nominal), 0) as total FROM pembelian_persediaan WHERE ${pengeluaranWhere.join(" AND ")}`,
    params
  );

  const totalPembelian = Number(totalPengeluaranRow.rows[0]?.total || 0) + Number(totalPembelianPersediaan.rows[0]?.total || 0);

  const utangAktif = await pool.query(
    `SELECT COALESCE(SUM(nominal_sisa), 0) as total
     FROM utang_piutang
     WHERE user_id=$1 AND tipe='Utang' AND status='Belum Lunas'`,
    [userId]
  );
  const piutangAktif = await pool.query(
    `SELECT COALESCE(SUM(nominal_sisa), 0) as total
     FROM utang_piutang
     WHERE user_id=$1 AND tipe='Piutang' AND status='Belum Lunas'`,
    [userId]
  );

  const totalAset = await pool.query(`SELECT COALESCE(SUM(harga_beli), 0) as total FROM aset_tetap WHERE user_id=$1`, [
    userId
  ]);

  return {
    year,
    totalPenjualan: Number(totalPenjualan.rows[0]?.total || 0),
    totalPembelian,
    utangAktif: Number(utangAktif.rows[0]?.total || 0),
    piutangAktif: Number(piutangAktif.rows[0]?.total || 0),
    totalAset: Number(totalAset.rows[0]?.total || 0)
  };
}

export { labaRugi, neraca, dashboard };
