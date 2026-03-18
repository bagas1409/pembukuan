import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { list, getById } from "../controllers/utangPiutangController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", list);
router.get("/:id", getById);

export default router;
