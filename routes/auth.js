const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ===== GENERATE JWT TOKEN =====
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || "fallback_secret_key",
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// ===== AUTHENTICATE TOKEN MIDDLEWARE =====
// Exported so budget.js, progress.js, savings.js can import it
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ========================================
// SIGNUP ROUTE - POST /api/auth/signup
// ========================================
router.post("/signup", async function(req, res) {
  try {
    console.log("📥 Signup request received:", req.body);

    const { phoneNumber, password, name, email, profileType } = req.body;

    // Validation
    if (!phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this phone number",
      });
    }

    // Create new user
    const user = new User({
      phoneNumber,
      password,
      name: name || "",
      email: email || "",
      profile: {
        type: profileType || "other",
        preferredLanguage: "en",
        audioEnabled: false,
        largeText: false,
      },
      progress: {
        completedLessons: 0,
        goalsStarted: 0,
        skillsLearned: 0,
        progressBars: {
          basics: 0,
          savings: 0,
          digital: 0,
          schemes: 0,
        },
      },
    });

    // Save user (password will be hashed by pre-save middleware)
    await user.save();
    console.log("✅ User created:", user.phoneNumber);

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        profile: user.profile,
        progress: user.progress,
      },
    });

  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error during signup",
    });
  }
});

// ========================================
// LOGIN ROUTE - POST /api/auth/login
// ========================================
router.post("/login", async function(req, res) {
  try {
    console.log("📥 Login request received:", req.body.phoneNumber);

    const { phoneNumber, password } = req.body;

    // Validation
    if (!phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required",
      });
    }

    // Find user and include password field
    const user = await User.findOne({ phoneNumber }).select("+password");

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();
    console.log("✅ User logged in:", user.phoneNumber);

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        profile: user.profile,
        progress: user.progress,
      },
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error during login",
    });
  }
});

// ========================================
// GET CURRENT USER - GET /api/auth/me
// ========================================
router.get("/me", authenticateToken, async function(req, res) {
  try {
    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        profile: user.profile,
        progress: user.progress,
      },
    });

  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ========================================
// UPDATE PROFILE - PUT /api/auth/profile
// ========================================
router.put("/profile", authenticateToken, async function(req, res) {
  try {
    const { name, email, preferredLanguage, audioEnabled, largeText } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (preferredLanguage !== undefined) user.profile.preferredLanguage = preferredLanguage;
    if (audioEnabled !== undefined) user.profile.audioEnabled = audioEnabled;
    if (largeText !== undefined) user.profile.largeText = largeText;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        profile: user.profile,
        progress: user.progress,
      },
    });

  } catch (error) {
    console.error("❌ Update profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ========================================
// LOGOUT ROUTE - POST /api/auth/logout
// ========================================
router.post("/logout", function(req, res) {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// ✅ Export both router AND authenticateToken so other route files can import it:
//    const { authenticateToken } = require("./auth");
module.exports = router;
module.exports.authenticateToken = authenticateToken;
