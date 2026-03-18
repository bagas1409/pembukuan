import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { create, list, update, remove } from "../controllers/pengeluaranController.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", create);
router.get("/", list);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
