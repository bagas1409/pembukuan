import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { create, list, getById, update, remove } from "../controllers/pemasukanController.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", create);
router.get("/", list);
router.get("/:id", getById);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
