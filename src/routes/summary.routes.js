import express from "express";
import {
  typeSummary,
  categorySummary,
  monthlySummary,
} from "../controllers/summary.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/type", typeSummary);
router.get("/category", categorySummary);
router.get("/monthly", monthlySummary);

export default router;
