import Transaction from "../models/Transaction.js";

/**
 * CREATE
 */
export const createTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      user: req.user.id,
    });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET with FILTER + PAGINATION + SEARCH
 */
export const getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const query = { user: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (search) query.note = { $regex: search, $options: "i" };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const total = await Transaction.countDocuments(query);

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      transactions,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * UPDATE
 */
export const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE
 */
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
