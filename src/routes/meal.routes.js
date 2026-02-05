import express from "express";
import {
  createMeal,
  getMeals,
  getMealDetails,
  addMealRecord,
  addPersonRecord,
  bulkAddPersonData,
  updateMealRecord,
  addMealExpense,
  updateMealExpense,
  deleteMealExpense,
  addFinalSettlement,
  getFinalSettlements,
  updateFinalSettlement,
  deleteFinalSettlement,
  calculateSettlement,
  closeMeal,
  reactivateMeal,
  clearMealHistory,
  deleteMeal,
} from "../controllers/meal.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Meal operations
router.post("/", createMeal);
router.get("/", getMeals);
router.get("/:id", getMealDetails);
router.put("/:id/close", closeMeal);
router.put("/:id/reactivate", reactivateMeal);
router.put("/:id/clear-history", clearMealHistory);
router.delete("/:id", deleteMeal);

// Meal records
router.post("/:id/records", addMealRecord);
router.post("/:id/person-record", addPersonRecord);
router.post("/:id/bulk-add", bulkAddPersonData);
router.put("/records/:id", updateMealRecord);

// Meal expenses
router.post("/:id/expenses", addMealExpense);
router.put("/expenses/:id", updateMealExpense);
router.delete("/expenses/:id", deleteMealExpense);

// Settlement
router.post("/:id/settlement", calculateSettlement);
// Final monthly settlement adjustments
router.post("/:id/final-settlement", addFinalSettlement);
router.get("/:id/final-settlement", getFinalSettlements);
router.put("/final-settlement/:id", updateFinalSettlement);
router.delete("/final-settlement/:id", deleteFinalSettlement);

export default router;
