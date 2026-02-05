import mongoose from "mongoose";

const mealSettlementSchema = new mongoose.Schema(
  {
    meal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meal",
      required: true,
    },
    person: {
      name: String,
      email: String,
    },
    totalMealsCount: {
      type: Number,
      default: 0,
    },
    perMealCost: {
      type: Number,
      default: 0,
    },
    personalShare: {
      type: Number,
      default: 0,
      description: "Total amount they should pay based on meals consumed",
    },
    amountPaid: {
      type: Number,
      default: 0,
      description: "Total amount they actually paid for groceries/expenses",
    },
    balance: {
      type: Number,
      default: 0,
      description: "Absolute difference between personalShare and amountPaid",
    },
    balanceType: {
      type: String,
      enum: ["owes", "owed"],
      default: "owes",
      description: "'owes' = they need to pay more | 'owed' = they should be paid back",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MealSettlement", mealSettlementSchema);
