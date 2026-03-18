import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { labaRugi, neraca, dashboard, pdf, xlsx, csv } from "../controllers/laporanController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/laba-rugi", labaRugi);
router.get("/neraca", neraca);
router.get("/dashboard", dashboard);
router.get("/pdf", pdf);
router.get("/xlsx", xlsx);
router.get("/csv", csv);

export default router;
