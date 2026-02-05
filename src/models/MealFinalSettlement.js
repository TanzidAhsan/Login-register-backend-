import mongoose from "mongoose";

const mealFinalSettlementSchema = new mongoose.Schema(
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
    extraPaid: {
      type: Number,
      default: 0,
    },
    extraDescription: String,
    previousAmountPaid: {
      type: Number,
      default: 0,
    },
    personalShare: {
      type: Number,
      default: 0,
    },
    finalBalance: {
      type: Number,
      default: 0,
    },
    finalType: {
      type: String,
      enum: ["Needs to Pay", "To Receive"],
      default: "Needs to Pay",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MealFinalSettlement", mealFinalSettlementSchema);
