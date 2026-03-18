import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { create, list, remove } from "../controllers/persediaanController.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", create);
router.get("/", list);
router.delete("/:id", remove);

export default router;
