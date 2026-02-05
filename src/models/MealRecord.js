import mongoose from "mongoose";

const mealRecordSchema = new mongoose.Schema(
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
    day: String,
    // Optional aggregate counts (legacy)
    lunchCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dinnerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Per-participant entries (preferred)
    entries: [
      {
        participant: {
          name: String,
          email: String,
        },
        lunchCount: { type: Number, default: 0, min: 0 },
        dinnerCount: { type: Number, default: 0, min: 0 },
        totalMealsCount: { type: Number, default: 0 },
      },
    ],
    totalMealsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("MealRecord", mealRecordSchema);
