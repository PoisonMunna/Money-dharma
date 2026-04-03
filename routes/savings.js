const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("./auth");

// ===== GET SAVINGS DATA =====
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      savings: user.savings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== SET SAVINGS GOAL =====
router.post("/goal", authenticateToken, async (req, res) => {
  try {
    const { savingsGoal, targetAmount, weeklySavings } = req.body;

    if (!savingsGoal || !targetAmount || !weeklySavings) {
      return res.status(400).json({
        success: false,
        message: "Goal, target amount, and weekly savings are required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.savings.savingsGoal = savingsGoal;
    user.savings.targetAmount = targetAmount;
    user.savings.weeklySavings = weeklySavings;

    // Calculate weeks needed
    const weeksNeeded = Math.ceil(targetAmount / weeklySavings);
    const monthsNeeded = (weeksNeeded / 4.33).toFixed(1);

    await user.save();

    res.json({
      success: true,
      message: "Savings goal set successfully",
      savings: user.savings,
      projection: {
        weeksNeeded,
        monthsNeeded,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== ADD SAVINGS =====
router.post("/add", authenticateToken, async (req, res) => {
  try {
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Add savings record
    user.savings.savingsHistory.push({
      amount,
      date: new Date(),
      note: note || "",
    });

    // Update total saved
    user.savings.totalSaved += amount;

    await user.save();

    // Calculate progress towards goal
    let progressPercentage = 0;
    if (user.savings.targetAmount > 0) {
      progressPercentage = Math.min(
        (user.savings.totalSaved / user.savings.targetAmount) * 100,
        100
      );
    }

    res.json({
      success: true,
      message: "Savings added successfully",
      savings: user.savings,
      progress: {
        totalSaved: user.savings.totalSaved,
        targetAmount: user.savings.targetAmount,
        progressPercentage,
        remaining:
          user.savings.targetAmount - user.savings.totalSaved,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== GET SAVINGS PROGRESS =====
router.get("/progress", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetAmount = user.savings.targetAmount || 0;
    const totalSaved = user.savings.totalSaved || 0;
    const progressPercentage =
      targetAmount > 0 ? (totalSaved / targetAmount) * 100 : 0;

    const savingsHistory = user.savings.savingsHistory || [];
    const thisMonthSavings = savingsHistory
      .filter(
        (record) =>
          new Date(record.date).getMonth() === new Date().getMonth() &&
          new Date(record.date).getFullYear() === new Date().getFullYear()
      )
      .reduce((sum, record) => sum + record.amount, 0);

    res.json({
      success: true,
      progress: {
        savingsGoal: user.savings.savingsGoal,
        targetAmount,
        totalSaved,
        progressPercentage: Math.min(progressPercentage, 100),
        remaining: Math.max(targetAmount - totalSaved, 0),
        weeklySavings: user.savings.weeklySavings,
        thisMonthSavings,
        savingsCount: savingsHistory.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== GET SAVINGS HISTORY =====
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Sort by date descending
    const sortedHistory = user.savings.savingsHistory
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50); // Get last 50 entries

    res.json({
      success: true,
      history: sortedHistory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== DELETE SAVINGS RECORD =====
router.delete("/record/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find and remove the record
    const recordIndex = user.savings.savingsHistory.findIndex(
      (_, index) => index.toString() === req.params.id
    );

    if (recordIndex > -1) {
      const amount = user.savings.savingsHistory[recordIndex].amount;
      user.savings.savingsHistory.splice(recordIndex, 1);
      user.savings.totalSaved -= amount;

      await user.save();

      return res.json({
        success: true,
        message: "Savings record deleted",
        savings: user.savings,
      });
    }

    res.status(404).json({
      success: false,
      message: "Record not found",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== RESET SAVINGS GOAL =====
router.post("/reset", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.savings = {
      savingsGoal: "",
      targetAmount: 0,
      weeklySavings: 0,
      totalSaved: 0,
      savingsHistory: [],
    };

    await user.save();

    res.json({
      success: true,
      message: "Savings goal reset",
      savings: user.savings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
