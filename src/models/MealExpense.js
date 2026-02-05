import mongoose from "mongoose";

const mealExpenseSchema = new mongoose.Schema(
  {
    meal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meal",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidBy: {
      name: String,
      email: String,
    },
    category: {
      type: String,
      default: "Groceries",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MealExpense", mealExpenseSchema);
