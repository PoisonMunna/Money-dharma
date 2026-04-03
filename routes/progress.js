const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("./auth");

// ===== GET USER PROGRESS =====
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
      progress: user.progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== UPDATE PROGRESS =====
router.put("/", authenticateToken, async (req, res) => {
  try {
    const { completedLessons, goalsStarted, skillsLearned } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update progress fields
    if (completedLessons !== undefined) {
      user.progress.completedLessons = completedLessons;
    }
    if (goalsStarted !== undefined) {
      user.progress.goalsStarted = goalsStarted;
    }
    if (skillsLearned !== undefined) {
      user.progress.skillsLearned = skillsLearned;
    }

    // Update progress bars
    user.progress.progressBars.basics = Math.min(
      Math.round((completedLessons / 6) * 100),
      100
    );
    user.progress.progressBars.savings = Math.min(
      Math.round(((completedLessons + goalsStarted) / 6) * 80),
      100
    );
    user.progress.progressBars.digital = Math.min(
      Math.round((completedLessons / 6) * 60),
      100
    );
    user.progress.progressBars.schemes = Math.min(
      Math.round((completedLessons / 6) * 50),
      100
    );

    await user.save();

    res.json({
      success: true,
      message: "Progress updated successfully",
      progress: user.progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== ADD COMPLETED LESSON =====
router.post("/lesson", authenticateToken, async (req, res) => {
  try {
    const { lessonId, lessonName, score } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Add to lessons data
    user.progress.lessonsData.push({
      lessonId,
      lessonName,
      completedAt: new Date(),
      score: score || 0,
    });

    // Increment completed lessons
    user.progress.completedLessons += 1;

    // Update skills learned
    user.progress.skillsLearned = Math.min(
      user.progress.completedLessons + user.progress.goalsStarted,
      10
    );

    await user.save();

    res.json({
      success: true,
      message: "Lesson marked as complete",
      progress: user.progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===== ADD SAVINGS GOAL =====
router.post("/goal", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Increment goals started
    user.progress.goalsStarted += 1;

    // Update skills learned
    user.progress.skillsLearned = Math.min(
      user.progress.completedLessons + user.progress.goalsStarted,
      10
    );

    await user.save();

    res.json({
      success: true,
      message: "Savings goal added",
      progress: user.progress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
