function rowsRingkasan(dashboard) {
  return [
    { label: "Total Pemasukan", value: dashboard.totalPenjualan, bold: true },
    { label: "Total Pengeluaran", value: dashboard.totalPembelian, minus: true },
    { label: "Piutang Aktif", value: dashboard.piutangAktif },
    { label: "Utang Aktif", value: dashboard.utangAktif, minus: true },
    { label: "Total Aset", value: dashboard.totalAset, bold: true }
  ];
}

function rowsLabaRugi(lr) {
  return [
    { label: "Pendapatan", header: true },
    { label: "Penjualan", value: lr.pendapatan.penjualan, indent: true },
    { label: "Retur Penjualan", value: lr.pendapatan.returPenjualan, indent: true, minus: true },
    { label: "Potongan Penjualan", value: lr.pendapatan.potonganPenjualan, indent: true, minus: true },
    { label: "Pendapatan Bersih", value: lr.pendapatan.pendapatanBersih, bold: true },

    { spacer: true },
    { label: "HPP", header: true },
    { label: "Persediaan Awal", value: lr.hpp.persediaanAwal, indent: true },
    { label: "Pembelian Barang", value: lr.hpp.pembelianBarang, indent: true },
    { label: "Ongkos Angkut", value: lr.hpp.ongkosAngkut, indent: true },
    { label: "Retur Pembelian", value: lr.hpp.returPembelian, indent: true, minus: true },
    { label: "Potongan Pembelian", value: lr.hpp.potonganPembelian, indent: true, minus: true },
    { label: "Persediaan Akhir", value: lr.hpp.persediaanAkhir, indent: true, minus: true },
    { label: "HPP", value: lr.hpp.hpp, bold: true },

    { spacer: true },
    { label: "Beban", header: true },
    { label: "Beban Operasional", value: lr.beban.bebanOperasional, indent: true, minus: true },
    { label: "Beban Lain-lain", value: lr.beban.bebanLain, indent: true, minus: true },
    { label: "Prive", value: lr.beban.prive, indent: true, minus: true },
    { label: "Total Beban", value: lr.beban.totalBeban, bold: true, minus: true },

    { spacer: true },
    { label: "Ringkasan", header: true },
    { label: "Laba Kotor", value: lr.ringkasan.labaKotor, bold: true },
    { label: "Laba Bersih", value: lr.ringkasan.labaBersih, bold: true }
  ];
}

function rowsNeraca(nr) {
  return [
    { label: "Aktiva", header: true },
    { label: "Kas/Bank", value: nr.aktiva.kasBank, indent: true },
    { label: "Piutang Usaha", value: nr.aktiva.piutangUsaha, indent: true },
    { label: "Persediaan", value: nr.aktiva.persediaan, indent: true },
    { label: "Aset Tetap", value: nr.aktiva.asetTetap, indent: true },
    { label: "Total Aktiva", value: nr.aktiva.totalAktiva, bold: true },

    { spacer: true },
    { label: "Pasiva", header: true },
    { label: "Utang Usaha", value: nr.pasiva.utangUsaha, indent: true, minus: true },
    { label: "Ekuitas", value: nr.pasiva.ekuitas, indent: true },
    { label: "Total Pasiva", value: nr.pasiva.totalPasiva, bold: true }
  ];
}

function formatRp(n) {
  const num = Number(n || 0);
  return "Rp " + num.toLocaleString("id-ID");
}

function formatRpMinus(n) {
  const num = Number(n || 0);
  return `(${formatRp(num)})`;
}

function safeFilePart(s) {
  return (
    String(s || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 60) || "User"
  );
}

export { rowsRingkasan, rowsLabaRugi, rowsNeraca, formatRp, formatRpMinus, safeFilePart };

