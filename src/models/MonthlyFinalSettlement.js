import mongoose from "mongoose";

const monthlyFinalSettlementSchema = new mongoose.Schema(
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
    previousAmountPaid: {
      type: Number,
      default: 0,
    },
    personalShare: {
      type: Number,
      default: 0,
    },
    mealSettlementBalance: {
      type: Number,
      default: 0,
    },
    mealSettlementBalanceType: {
      type: String,
      enum: ["owed", "owes"],
      default: "owed",
    },
    // backward-compatible aliases
    balance: {
      type: Number,
      default: 0,
    },
    balanceType: {
      type: String,
      enum: ["owed", "owes"],
      default: "owed",
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
    // Bill tracking
    bills: [
      {
        billType: {
          type: String,
          // Allow any string (built-in types + custom bill IDs)
        },
        customName: String,
        amount: {
          type: Number,
          default: 0,
        },
        description: String,
      },
    ],
    totalBills: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("MonthlyFinalSettlement", monthlyFinalSettlementSchema);
