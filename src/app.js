import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import pemasukanRoutes from "./routes/pemasukanRoutes.js";
import pengeluaranRoutes from "./routes/pengeluaranRoutes.js";
import persediaanRoutes from "./routes/persediaanRoutes.js";
import asetRoutes from "./routes/asetRoutes.js";
import utangPiutangRoutes from "./routes/utangPiutangRoutes.js";
import laporanRoutes from "./routes/laporanRoutes.js";

import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/pemasukan", pemasukanRoutes);
app.use("/pengeluaran", pengeluaranRoutes);
app.use("/persediaan", persediaanRoutes);
app.use("/aset", asetRoutes);
app.use("/utang-piutang", utangPiutangRoutes);
app.use("/laporan", laporanRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
