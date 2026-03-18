import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { list, create, remove } from "../controllers/asetController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);

export default router;
