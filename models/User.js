const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ===== Basic Info =====
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      minlength: 10,
      maxlength: 13,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      lowercase: true,
      default: "",
    },

    // ===== Authentication =====
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },

    // ===== Profile & Preferences =====
    profile: {
      type: {
        type: String,
        enum: ["daily_wage_worker", "rural_women", "bank_user", "youth", "other"],
        default: "other",
      },
      preferredLanguage: {
        type: String,
        enum: ["en", "hi"],
        default: "en",
      },
      audioEnabled: {
        type: Boolean,
        default: false,
      },
      largeText: {
        type: Boolean,
        default: false,
      },
    },

    // ===== Learning Progress =====
    progress: {
      completedLessons: {
        type: Number,
        default: 0,
      },
      lessonsData: [
        {
          lessonId: String,
          lessonName: String,
          completedAt: Date,
          score: Number,
        },
      ],
      goalsStarted: {
        type: Number,
        default: 0,
      },
      skillsLearned: {
        type: Number,
        default: 0,
      },
      progressBars: {
        basics: { type: Number, default: 0 },
        savings: { type: Number, default: 0 },
        digital: { type: Number, default: 0 },
        schemes: { type: Number, default: 0 },
      },
    },

    // ===== Financial Data =====
    budget: {
      monthlyIncome: {
        type: Number,
        default: 0,
      },
      expenses: [
        {
          category: String,
          amount: Number,
          date: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      lastUpdated: Date,
    },

    savings: {
      savingsGoal: {
        type: String,
        default: "",
      },
      targetAmount: {
        type: Number,
        default: 0,
      },
      weeklySavings: {
        type: Number,
        default: 0,
      },
      totalSaved: {
        type: Number,
        default: 0,
      },
      savingsHistory: [
        {
          amount: Number,
          date: {
            type: Date,
            default: Date.now,
          },
          note: String,
        },
      ],
    },

    // ===== Account Status =====
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,

    // ===== Reset Password =====
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // ===== Last Login =====
    lastLogin: Date,
  },
  {
    timestamps: true, // ✅ This auto-manages createdAt and updatedAt
  }
);

// ========================================
// ✅ FIXED: Hash password before saving
// ========================================
userSchema.pre("save", async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return ;
  }
    const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ❌ REMOVED: The second pre("save") hook for updatedAt
// timestamps: true already handles this automatically!

// ========================================
// METHODS
// ========================================

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get public profile (exclude sensitive data)
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpires;
  delete userObject.__v;
  return userObject;
};

// Update user progress
userSchema.methods.updateProgress = function (lessonData) {
  this.progress.completedLessons += 1;
  this.progress.lessonsData.push(lessonData);
  this.progress.skillsLearned = Math.min(
    this.progress.completedLessons + this.progress.goalsStarted,
    10
  );
};

// Update budget - add expense
userSchema.methods.addExpense = function (category, amount) {
  this.budget.expenses.push({ category, amount, date: new Date() });
  this.budget.lastUpdated = Date.now();
};

// Add savings
userSchema.methods.addSavings = function (amount, note = "") {
  this.savings.savingsHistory.push({ amount, note, date: new Date() });
  this.savings.totalSaved += amount;
};

// ========================================
// INDEXES
// ========================================
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
