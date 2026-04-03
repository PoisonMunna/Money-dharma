const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("./auth");

// ===== GET BUDGET DATA =====
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
      budget: user.budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== SET MONTHLY INCOME =====
router.post("/income", authenticateToken, async (req, res) => {
  try {
    const { monthlyIncome } = req.body;

    if (!monthlyIncome || monthlyIncome < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid monthly income is required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.budget.monthlyIncome = monthlyIncome;
    user.budget.lastUpdated = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Monthly income updated",
      budget: user.budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== ADD EXPENSE =====
router.post("/expense", authenticateToken, async (req, res) => {
  try {
    const { category, amount } = req.body;

    if (!category || !amount || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid category and amount are required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.budget.expenses.push({
      category,
      amount,
      date: new Date(),
    });

    user.budget.lastUpdated = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Expense added successfully",
      budget: user.budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== GET EXPENSES SUMMARY =====
router.get("/summary", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const totalExpenses = user.budget.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const expenseByCategory = {};
    user.budget.expenses.forEach((expense) => {
      expenseByCategory[expense.category] =
        (expenseByCategory[expense.category] || 0) + expense.amount;
    });

    const remaining = user.budget.monthlyIncome - totalExpenses;

    res.json({
      success: true,
      summary: {
        monthlyIncome: user.budget.monthlyIncome,
        totalExpenses,
        remaining,
        expenseByCategory,
        expenseCount: user.budget.expenses.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== DELETE EXPENSE =====
router.delete("/expense/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove expense by index or ID
    user.budget.expenses = user.budget.expenses.filter(
      (_, index) => index.toString() !== req.params.id
    );

    user.budget.lastUpdated = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Expense deleted",
      budget: user.budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== CLEAR ALL EXPENSES =====
router.delete("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.budget.expenses = [];
    user.budget.lastUpdated = new Date();
    await user.save();

    res.json({
      success: true,
      message: "All expenses cleared",
      budget: user.budget,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
