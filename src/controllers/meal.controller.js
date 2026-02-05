import Meal from "../models/Meal.js";
import MealRecord from "../models/MealRecord.js";
import MealExpense from "../models/MealExpense.js";
import MealSettlement from "../models/MealSettlement.js";
import MonthlyFinalSettlement from "../models/MonthlyFinalSettlement.js";

// Helper: compute final balance using signed meal balance logic
// If balanceType is 'owes' (red): person owes money, so positive mealBalance adds to bills
// If balanceType is 'owed' (green): person is owed money, so it subtracts from bills
const computeFinalBalance = (totalBills, mealBalance, balanceType) => {
  const mealBalanceSigned = (balanceType === 'owes') ? Number(mealBalance || 0) : -Number(mealBalance || 0);
  const rawFinal = Number(totalBills || 0) + mealBalanceSigned;
  return {
    finalBalance: Math.abs(rawFinal),
    finalType: rawFinal > 0 ? 'Needs to Pay' : 'To Receive',
    rawFinal
  };
};

// Add or update a single participant's daily record (and optional spend)
export const addPersonRecord = async (req, res) => {
  try {
    const mealId = req.params.id;
    const { date, participant, lunchCount, dinnerCount, spend } = req.body;

    if (!participant || (!participant.name && !participant.email)) {
      return res.status(400).json({ message: "participant (name or email) is required" });
    }

    // find or create record for the date
    let record = await MealRecord.findOne({ meal: mealId, date });
    const entryTotal = Number(lunchCount || 0) + Number(dinnerCount || 0);

    if (!record) {
      const newEntry = {
        participant: { name: participant.name || "", email: participant.email || "" },
        lunchCount: Number(lunchCount || 0),
        dinnerCount: Number(dinnerCount || 0),
        totalMealsCount: entryTotal,
      };
      const totalMealsCount = entryTotal;
      record = await MealRecord.create({ meal: mealId, date, day: new Date(date).toLocaleDateString("en-US", { weekday: "long" }), entries: [newEntry], totalMealsCount });
    } else {
      // ensure entries array
      const entries = record.entries || [];
      const matchIdx = entries.findIndex(
        (e) => (e.participant.email && participant.email && e.participant.email === participant.email) || (e.participant.name && participant.name && e.participant.name === participant.name)
      );

      if (matchIdx >= 0) {
        // update existing entry
        entries[matchIdx].lunchCount = Number(lunchCount || entries[matchIdx].lunchCount || 0);
        entries[matchIdx].dinnerCount = Number(dinnerCount || entries[matchIdx].dinnerCount || 0);
        entries[matchIdx].totalMealsCount = entries[matchIdx].lunchCount + entries[matchIdx].dinnerCount;
      } else {
        entries.push({ participant: { name: participant.name || "", email: participant.email || "" }, lunchCount: Number(lunchCount || 0), dinnerCount: Number(dinnerCount || 0), totalMealsCount: entryTotal });
      }

      const totalMealsCount = entries.reduce((s, it) => s + (it.totalMealsCount || 0), 0);
      record.entries = entries;
      record.totalMealsCount = totalMealsCount;
      await record.save();
    }

    // optional spend -> create expense
    let expense = null;
    if (spend && spend.amount && Number(spend.amount) > 0) {
      expense = await MealExpense.create({ meal: mealId, date, description: spend.description || "", amount: Number(spend.amount), paidBy: { name: participant.name || "", email: participant.email || "" } });
    }

    res.status(201).json({ record, expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bulk add: Add total meals and total spend by a person at once (for catch-up)
export const bulkAddPersonData = async (req, res) => {
  try {
    const mealId = req.params.id;
    const { participant, totalMeals, totalSpend, description } = req.body;

    if (!participant || (!participant.name && !participant.email)) {
      return res.status(400).json({ message: "participant (name or email) is required" });
    }

    if (!totalMeals || totalMeals <= 0) {
      return res.status(400).json({ message: "totalMeals must be greater than 0" });
    }

    // Create or update a meal record for today with the total meals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let record = await MealRecord.findOne({ meal: mealId, date: today });
    
    if (!record) {
      const newEntry = {
        participant: { name: participant.name || "", email: participant.email || "" },
        lunchCount: 0,
        dinnerCount: 0,
        totalMealsCount: Number(totalMeals),
      };
      record = await MealRecord.create({
        meal: mealId,
        date: today,
        day: today.toLocaleDateString("en-US", { weekday: "long" }),
        entries: [newEntry],
        totalMealsCount: Number(totalMeals),
      });
    } else {
      const entries = record.entries || [];
      const matchIdx = entries.findIndex(
        (e) => (e.participant.email && participant.email && e.participant.email === participant.email) || 
               (e.participant.name && participant.name && e.participant.name === participant.name)
      );

      if (matchIdx >= 0) {
        entries[matchIdx].totalMealsCount = Number(totalMeals);
        entries[matchIdx].lunchCount = 0;
        entries[matchIdx].dinnerCount = 0;
      } else {
        entries.push({
          participant: { name: participant.name || "", email: participant.email || "" },
          lunchCount: 0,
          dinnerCount: 0,
          totalMealsCount: Number(totalMeals),
        });
      }

      const totalMealsCount = entries.reduce((s, it) => s + (it.totalMealsCount || 0), 0);
      record.entries = entries;
      record.totalMealsCount = totalMealsCount;
      await record.save();
    }

    // Create expense if spend is provided
    let expense = null;
    if (totalSpend && Number(totalSpend) > 0) {
      expense = await MealExpense.create({
        meal: mealId,
        date: today,
        description: description || `Bulk add spend by ${participant.name || participant.email}`,
        amount: Number(totalSpend),
        paidBy: { name: participant.name || "", email: participant.email || "" },
        category: "Manual Entry",
      });
    }

    res.status(201).json({ record, expense, message: "Bulk data added successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new meal system
export const createMeal = async (req, res) => {
  try {
    const { month, year, totalPersons, participants } = req.body;

    // Make any existing active meal(s) for this user inactive (closed)
    await Meal.updateMany({ user: req.user.id, status: "active" }, { status: "closed" });

    const meal = await Meal.create({
      user: req.user.id,
      month,
      year,
      totalPersons,
      participants,
      status: "active",
    });

    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all meals for user
export const getMeals = async (req, res) => {
  try {
    // Fetch all meals for the user and order so active comes first,
    // then remaining meals sorted by year (desc) then month (desc)
    const meals = await Meal.find({ user: req.user.id });

    meals.sort((a, b) => {
      // active first
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;

      // then by year desc, then month desc
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    res.json(meals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single meal with all details
export const getMealDetails = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    const records = await MealRecord.find({ meal: meal._id });
    const expenses = await MealExpense.find({ meal: meal._id });
    const settlements = await MealSettlement.find({ meal: meal._id });
    let finalSettlements = await MonthlyFinalSettlement.find({ meal: meal._id });

    // Merge latest settlement values into finalSettlements for UI consistency
    if (finalSettlements && finalSettlements.length > 0 && settlements && settlements.length > 0) {
      finalSettlements = finalSettlements.map((fs) => {
        // find matching settlement by email first then by name
        const match = settlements.find((s) => {
          if (fs.person?.email && s.person?.email) return fs.person.email === s.person.email;
          if (fs.person?.name && s.person?.name) return fs.person.name === s.person.name;
          return false;
        });

        if (match) {
          // override snapshot fields with latest computed values
          fs.previousAmountPaid = match.amountPaid || 0;
          fs.personalShare = match.personalShare || 0;
          fs.mealSettlementBalance = match.balance || 0;
          fs.mealSettlementBalanceType = match.balanceType || 'owed';
          // keep aliases in sync
          fs.balance = match.balance || 0;
          fs.balanceType = match.balanceType || 'owed';

          // Recompute final balance with latest settlement values using signed-balance logic
          const { finalBalance, finalType } = computeFinalBalance(
            fs.totalBills,
            match.balance || 0,
            match.balanceType || 'owed'
          );
          fs.finalBalance = finalBalance;
          fs.finalType = finalType;
        }
        return fs;
      });
    }

    res.json({ meal, records, expenses, settlements, finalSettlements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add daily meal record
export const addMealRecord = async (req, res) => {
  try {
    const { mealId, date, lunchCount, dinnerCount, entries } = req.body;

    // If entries provided, compute totals from entries
    if (entries && Array.isArray(entries) && entries.length > 0) {
      const processedEntries = entries.map((e) => ({
        participant: e.participant || { name: e.name || "", email: e.email || "" },
        lunchCount: Number(e.lunchCount || 0),
        dinnerCount: Number(e.dinnerCount || 0),
        totalMealsCount: Number((e.lunchCount || 0) + (e.dinnerCount || 0)),
      }));

      const totalMealsCount = processedEntries.reduce((s, it) => s + it.totalMealsCount, 0);

      const record = await MealRecord.create({
        meal: mealId,
        date,
        day: new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
        entries: processedEntries,
        totalMealsCount,
      });

      return res.status(201).json(record);
    }

    // Fallback to legacy aggregate fields
    const totalMealsCount = Number(lunchCount || 0) + Number(dinnerCount || 0);

    const record = await MealRecord.create({
      meal: mealId,
      date,
      day: new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
      lunchCount: Number(lunchCount || 0),
      dinnerCount: Number(dinnerCount || 0),
      totalMealsCount,
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update meal record
export const updateMealRecord = async (req, res) => {
  try {
    const { lunchCount, dinnerCount, entries } = req.body;

    if (entries && Array.isArray(entries)) {
      const processedEntries = entries.map((e) => ({
        participant: e.participant || { name: e.name || "", email: e.email || "" },
        lunchCount: Number(e.lunchCount || 0),
        dinnerCount: Number(e.dinnerCount || 0),
        totalMealsCount: Number((e.lunchCount || 0) + (e.dinnerCount || 0)),
      }));

      const totalMealsCount = processedEntries.reduce((s, it) => s + it.totalMealsCount, 0);

      const record = await MealRecord.findByIdAndUpdate(
        req.params.id,
        { entries: processedEntries, totalMealsCount },
        { new: true }
      );

      return res.json(record);
    }

    const totalMealsCount = Number(lunchCount || 0) + Number(dinnerCount || 0);
    const record = await MealRecord.findByIdAndUpdate(
      req.params.id,
      { lunchCount: Number(lunchCount || 0), dinnerCount: Number(dinnerCount || 0), totalMealsCount },
      { new: true }
    );

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add meal expense
export const addMealExpense = async (req, res) => {
  try {
    const { mealId, date, description, amount, paidBy, category } = req.body;

    const expense = await MealExpense.create({
      meal: mealId,
      date,
      description,
      amount,
      paidBy,
      category,
    });

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete meal expense
export const deleteMealExpense = async (req, res) => {
  try {
    await MealExpense.findByIdAndDelete(req.params.id);
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update meal expense
export const updateMealExpense = async (req, res) => {
  try {
    const { date, description, amount, paidBy, category } = req.body;

    const expense = await MealExpense.findByIdAndUpdate(
      req.params.id,
      { date, description, amount, paidBy, category },
      { new: true }
    );

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add final settlement adjustments (person-wise extra bills) and calculate final balances
export const addFinalSettlement = async (req, res) => {
  try {
    const mealId = req.params.id;
    const { entries } = req.body; // entries: [{ person: {name, email}, extraPaid, extraDescription, bills: [{billType, amount, description}] }]

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "entries array is required" });
    }

    // Ensure latest settlements exist — compute if not present so final settlement uses up-to-date values
    let settlements = await MealSettlement.find({ meal: mealId });
    if (!settlements || settlements.length === 0) {
      // compute and persist settlements
      settlements = await computeAndSaveSettlements(mealId);
    }
    const meal = await Meal.findById(mealId);

    // prepare final entries from provided rows
    const finalEntries = (entries || []).map((it) => {
      // Use proper matching - match by email first, then by name
      const match = settlements.find((s) => {
        if (it.person.email && s.person?.email) {
          return s.person.email === it.person.email;
        }
        if (it.person.name && s.person?.name) {
          return s.person.name === it.person.name;
        }
        return false;
      });

      const previousAmountPaid = match ? (match.amountPaid || 0) : 0;
      const personalShare = match ? (match.personalShare || 0) : 0;
      const balanceType = match ? (match.balanceType || 'owed') : 'owed';
      const mealBalance = match ? (match.balance || 0) : 0;
      
      // Calculate total bills
      const bills = (it.bills || []).filter(b => b.billType && Number(b.amount) > 0);
      const totalBills = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
      
      // Compute final balance using signed meal balance logic
      const { finalBalance, finalType } = computeFinalBalance(totalBills, mealBalance, balanceType);

      return {
        meal: mealId,
        person: { name: it.person.name || "", email: it.person.email || "" },
        previousAmountPaid,
        personalShare,
        mealSettlementBalance: mealBalance,
        mealSettlementBalanceType: balanceType,
        // aliases for backward-compatibility with older frontend code
        balance: mealBalance,
        balanceType: balanceType,
        finalBalance: finalBalance,
        finalType,
        bills: bills,
        totalBills: totalBills,
      };
    });

    // Include participants who weren't provided in entries (store everyone)
    // Use settlements and meal.participants as sources of truth for participants
    const includedKeys = new Set(finalEntries.map(fe => (fe.person.name || fe.person.email || "").toString()));

    // from settlements
    (settlements || []).forEach((s) => {
      const key = (s.person?.name || s.person?.email || "").toString();
      if (includedKeys.has(key)) return;
      const previousAmountPaid = s.amountPaid || 0;
      const personalShare = s.personalShare || 0;
      const balanceType = s.balanceType || 'owed';
      const mealBalance = s.balance || 0;
      const totalBills = 0;
      
      // Compute final balance using signed meal balance logic
      const { finalBalance: finalBalance2, finalType: finalType2 } = computeFinalBalance(totalBills, mealBalance, balanceType);

      finalEntries.push({
        meal: mealId,
        person: { name: s.person?.name || "", email: s.person?.email || "" },
        previousAmountPaid,
        personalShare,
        mealSettlementBalance: mealBalance,
        mealSettlementBalanceType: balanceType,
        balance: mealBalance,
        balanceType: balanceType,
        finalBalance: finalBalance2,
        finalType: finalType2,
        bills: [],
        totalBills: 0,
      });
      includedKeys.add(key);
    });

    // also include any meal.participants not yet included
    (meal?.participants || []).forEach((p) => {
      const key = (p.name || p.email || "").toString();
      if (includedKeys.has(key)) return;
      // try to find a settlement for this person using proper matching
      const match = (settlements || []).find((s) => {
        if (p.email && s.person?.email) {
          return s.person.email === p.email;
        }
        if (p.name && s.person?.name) {
          return s.person.name === p.name;
        }
        return false;
      });
      const previousAmountPaid = match ? (match.amountPaid || 0) : 0;
      const personalShare = match ? (match.personalShare || 0) : 0;
      const balanceType = match ? (match.balanceType || 'owed') : 'owed';
      const mealBalance = match ? (match.balance || 0) : 0;
      const totalBills = 0;
      
      // Compute final balance using signed meal balance logic
      const { finalBalance: finalBalance3, finalType: finalType3 } = computeFinalBalance(totalBills, mealBalance, balanceType);

      finalEntries.push({
        meal: mealId,
        person: { name: p.name || "", email: p.email || "" },
        previousAmountPaid,
        personalShare,
        mealSettlementBalance: mealBalance,
        mealSettlementBalanceType: balanceType,
        balance: mealBalance,
        balanceType: balanceType,
        finalBalance: finalBalance3,
        finalType: finalType3,
        bills: [],
        totalBills: 0,
      });
      includedKeys.add(key);
    });

    // replace previous final settlements
    await MonthlyFinalSettlement.deleteMany({ meal: mealId });
    const inserted = await MonthlyFinalSettlement.insertMany(finalEntries);

    res.json({ message: "Final settlement saved", finalSettlements: inserted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFinalSettlements = async (req, res) => {
  try {
    const mealId = req.params.id;
    const finalSettlements = await MonthlyFinalSettlement.find({ meal: mealId });
    res.json(finalSettlements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a final settlement entry
export const updateFinalSettlement = async (req, res) => {
  try {
    const finalId = req.params.id;
    const { bills } = req.body;

    const doc = await MonthlyFinalSettlement.findById(finalId);
    if (!doc) return res.status(404).json({ message: 'Final settlement not found' });

    // Update bills
    if (bills && Array.isArray(bills)) {
      doc.bills = bills.filter(b => b.billType && Number(b.amount) > 0);
      doc.totalBills = doc.bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    }

    // recompute using MealSettlement
    const settlements = await MealSettlement.find({ meal: doc.meal });
    const match = settlements.find((s) => (s.person.name === doc.person.name) || (s.person.email === doc.person.email));
    const previousAmountPaid = match ? (match.amountPaid || 0) : 0;
    const personalShare = match ? (match.personalShare || 0) : 0;
    const balanceType = match ? (match.balanceType || 'owed') : 'owed';
    const mealBalance = match ? (match.balance || 0) : 0;
    const totalBillsAmount = doc.totalBills || 0;
    
    doc.previousAmountPaid = previousAmountPaid;
    doc.personalShare = personalShare;
    doc.mealSettlementBalance = mealBalance;
    doc.mealSettlementBalanceType = balanceType;
    // keep aliases in sync
    doc.balance = mealBalance;
    doc.balanceType = balanceType;

    // Recompute final balance using signed meal balance logic
    const { finalBalance, finalType } = computeFinalBalance(doc.totalBills, mealBalance, balanceType);
    doc.finalBalance = finalBalance;
    doc.finalType = finalType;

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a final settlement entry
export const deleteFinalSettlement = async (req, res) => {
  try {
    await MonthlyFinalSettlement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Final settlement deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: compute and persist settlements for a meal and return them
const computeAndSaveSettlements = async (mealId) => {
  const meal = await Meal.findById(mealId);
  const records = await MealRecord.find({ meal: mealId });
  const expenses = await MealExpense.find({ meal: mealId });

  const totalMeals = records.reduce((sum, r) => {
    if (r.entries && r.entries.length > 0) return sum + r.totalMealsCount;
    return sum + (r.totalMealsCount || 0);
  }, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const perMealCost = totalMeals > 0 ? totalExpense / totalMeals : 0;

  const settlementData = {};
  (meal.participants || []).forEach((person) => {
    const key = person.name || person.email;
    settlementData[key] = {
      person: { name: person.name || "", email: person.email || "" },
      totalMealsCount: 0,
      personalShare: 0,
      amountPaid: 0,
      balance: 0,
      balanceType: "owes",
    };
  });

  records.forEach((record) => {
    if (record.entries && record.entries.length > 0) {
      record.entries.forEach((entry) => {
        const key = entry.participant?.name || entry.participant?.email || "Unknown";
        if (!settlementData[key]) {
          settlementData[key] = {
            person: { name: entry.participant?.name || "", email: entry.participant?.email || "" },
            totalMealsCount: 0,
            personalShare: 0,
            amountPaid: 0,
            balance: 0,
            balanceType: "owes",
          };
        }
        settlementData[key].totalMealsCount += (entry.totalMealsCount || 0);
      });
    } else {
      const approx = (record.totalMealsCount || 0);
      const per = meal.participants.length > 0 ? Math.round(approx / meal.participants.length) : 0;
      meal.participants.forEach((person) => {
        const key = person.name || person.email;
        settlementData[key].totalMealsCount += per;
      });
    }
  });

  Object.keys(settlementData).forEach((personKey) => {
    const entry = settlementData[personKey];
    entry.perMealCost = perMealCost;
    entry.personalShare = entry.totalMealsCount * perMealCost;

    const paidByPerson = (expenses || [])
      .filter((e) => {
        const eName = (e.paidBy?.name || "").toLowerCase().trim();
        const eEmail = (e.paidBy?.email || "").toLowerCase().trim();
        const personName = (entry.person?.name || "").toLowerCase().trim();
        const personEmail = (entry.person?.email || "").toLowerCase().trim();
        return (eName && personName && eName === personName) || (eEmail && personEmail && eEmail === personEmail);
      })
      .reduce((sum, e) => sum + e.amount, 0);

    entry.amountPaid = paidByPerson;
    const owed = entry.personalShare - entry.amountPaid;
    entry.balance = Math.abs(owed);
    entry.balanceType = owed > 0 ? "owes" : "owed";
  });

  await MealSettlement.deleteMany({ meal: mealId });
  const settlements = await MealSettlement.insertMany(Object.values(settlementData).map((s) => ({ meal: mealId, ...s })));
  return settlements;
};

export const calculateSettlement = async (req, res) => {
  try {
    const { mealId } = req.body;
    const settlements = await computeAndSaveSettlements(mealId);
    
    // Now sync all existing MonthlyFinalSettlement docs with new settlements
    const finalSettlements = await MonthlyFinalSettlement.find({ meal: mealId });
    if (finalSettlements && finalSettlements.length > 0) {
      for (const fs of finalSettlements) {
        // Find matching settlement
        const match = settlements.find((s) => {
          if (fs.person?.email && s.person?.email) return fs.person.email === s.person.email;
          if (fs.person?.name && s.person?.name) return fs.person.name === s.person.name;
          return false;
        });

        if (match) {
          fs.previousAmountPaid = match.amountPaid || 0;
          fs.personalShare = match.personalShare || 0;
          fs.mealSettlementBalance = match.balance || 0;
          fs.mealSettlementBalanceType = match.balanceType || 'owed';
          fs.balance = match.balance || 0;
          fs.balanceType = match.balanceType || 'owed';

          // Recompute final balance with latest settlement values using signed logic
          const { finalBalance, finalType } = computeFinalBalance(
            fs.totalBills,
            match.balance || 0,
            match.balanceType || 'owed'
          );
          fs.finalBalance = finalBalance;
          fs.finalType = finalType;
          await fs.save();
        }
      }
    }
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Close meal system
export const closeMeal = async (req, res) => {
  try {
    const meal = await Meal.findByIdAndUpdate(
      req.params.id,
      { status: "closed" },
      { new: true }
    );
    res.json(meal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete meal and all related records
export const deleteMeal = async (req, res) => {
  try {
    await MealRecord.deleteMany({ meal: req.params.id });
    await MealExpense.deleteMany({ meal: req.params.id });
    await MealSettlement.deleteMany({ meal: req.params.id });
    await MonthlyFinalSettlement.deleteMany({ meal: req.params.id });
    await Meal.findByIdAndDelete(req.params.id);

    res.json({ message: "Meal system deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reactivate a closed meal (make it active). Also close any other active meals for the user.
export const reactivateMeal = async (req, res) => {
  try {
    const mealId = req.params.id;
    const meal = await Meal.findById(mealId);
    if (!meal) return res.status(404).json({ message: 'Meal not found' });

    // Close any other active meals for this user
    await Meal.updateMany({ user: meal.user, status: 'active' }, { status: 'closed' });

    const updated = await Meal.findByIdAndUpdate(mealId, { status: 'active' }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Clear all history (records, expenses, settlements, final settlements) for a meal but keep the meal itself
export const clearMealHistory = async (req, res) => {
  try {
    const mealId = req.params.id;
    await MealRecord.deleteMany({ meal: mealId });
    await MealExpense.deleteMany({ meal: mealId });
    await MealSettlement.deleteMany({ meal: mealId });
    await MonthlyFinalSettlement.deleteMany({ meal: mealId });

    res.json({ message: 'Meal history cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
