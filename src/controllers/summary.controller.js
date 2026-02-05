import Transaction from "../models/Transaction.js";

/**
 * INCOME & EXPENSE SUMMARY
 */
export const typeSummary = async (req, res) => {
  const data = await Transaction.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]);

  res.json(data);
};

/**
 * CATEGORY WISE TOTAL
 */
export const categorySummary = async (req, res) => {
  const data = await Transaction.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" },
      },
    },
  ]);

  res.json(data);
};

/**
 * MONTHLY SUMMARY
 */
export const monthlySummary = async (req, res) => {
  const data = await Transaction.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: {
          month: { $month: "$date" },
          year: { $year: "$date" },
          type: "$type",
        },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  res.json(data);
};
