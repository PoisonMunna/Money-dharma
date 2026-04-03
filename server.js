require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("./database");

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ✅ FIX 1: CORS - Allow multiple frontend origins
// ✅ FIX: CORS - Allow multiple frontend origins including 127.0.0.1
const allowedOrigins = [
  "https://money-dharma.onrender.com/"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

// Body parser middleware with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ✅ FIX 2: Request logger for debugging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url} [${new Date().toLocaleTimeString()}]`);
  next();
});

// ========================================
// RATE LIMITING
// ========================================

const generalLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.AUTH_RATE_LIMIT_MAX || 20,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);

// ========================================
// STATIC FILES
// ========================================

// ========================================
// HEALTH CHECK (before other routes)
// ========================================
// ✅ FIX 3: Moved health check ABOVE other API routes
app.get("/api/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    let userCount = 0;
    if (dbState === 1) {
      try {
        const User = require("./models/User");
        userCount = await User.countDocuments();
      } catch (e) {
        console.warn("Could not fetch user count:", e.message);
      }
    }

    res.json({
      success: true,
      message: "MoneyDharma API running",
      timestamp: new Date().toISOString(),
      database: dbStatusMap[dbState] || "unknown",
      totalUsers: userCount,
      environment: process.env.NODE_ENV || "development",
      uptime: `${Math.floor(process.uptime())}s`,
      allowedOrigins: allowedOrigins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message,
    });
  }
});

// ========================================
// API ROUTES (loaded safely)
// ========================================
// ✅ FIX 4: Wrap route loading in try-catch to prevent crash
try {
  const authRoutes = require("./routes/auth");
  app.use("/api/auth", authLimiter, authRoutes);
  console.log("  ✅ Auth routes loaded");
} catch (err) {
  console.error("  ❌ Auth routes failed:", err.message);
}

try {
  const progressRoutes = require("./routes/progress");
  app.use("/api/progress", progressRoutes);
  console.log("  ✅ Progress routes loaded");
} catch (err) {
  console.error("  ❌ Progress routes failed:", err.message);
}

try {
  const budgetRoutes = require("./routes/budget");
  app.use("/api/budget", budgetRoutes);
  console.log("  ✅ Budget routes loaded");
} catch (err) {
  console.error("  ❌ Budget routes failed:", err.message);
}

try {
  const savingsRoutes = require("./routes/savings");
  app.use("/api/savings", savingsRoutes);
  console.log("  ✅ Savings routes loaded");
} catch (err) {
  console.error("  ❌ Savings routes failed:", err.message);
}

// ========================================
// ✅ FIX 5: API 404 handler (BEFORE SPA catch-all)
// ========================================
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      "GET  /api/health",
      "POST /api/auth/signup",
      "POST /api/auth/login",
      "GET  /api/progress",
      "GET  /api/budget",
      "GET  /api/savings",
    ],
  });
});

// ========================================
// PAGE ROUTES (SPA FALLBACK)
// ========================================
const pages = [
  "home",
  "onboarding",
  "dashboard",
  "learn",
  "tools",
  "schemes",
  "progress",
];



app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/voice-assistant.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'voice-assistant.js'));
});


app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname,  "index.html"))
);

pages.forEach((page) => {
  app.get(`/${page}`, (req, res) =>
    res.sendFile(path.join(__dirname, "index.html"))
  );
});

// ✅ FIX 6: Only serve HTML for non-API routes
app.get("*", (req, res) => {
  // Don't serve HTML for API routes
  if (req.url.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      message: "API route not found",
    });
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
// ✅ FIX 7: Better error handling with CORS error detection
app.use((err, req, res, next) => {
  console.error("─────────────────────────────────");
  console.error("❌ Error:", err.message);
  console.error("📍 Route:", req.method, req.originalUrl);
  console.error("🕐 Time:", new Date().toLocaleTimeString());
  if (process.env.NODE_ENV === "development") {
    console.error("📋 Stack:", err.stack);
  }
  console.error("─────────────────────────────────");

  // Handle CORS errors specifically
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      message: "CORS error: Origin not allowed",
      allowedOrigins: allowedOrigins,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ========================================
// SERVER STARTUP
// ========================================
async function startServer() {
  try {
    // ✅ FIX 8: Better connection error handling
    console.log("🔄 Connecting to MongoDB Atlas...");

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not defined in .env file! Create a .env file with:\nMONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>"
      );
    }

    await connectDB();
    console.log("✅ MongoDB connected successfully");

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔══════════════════════════════════════════════╗
║       🌱 MoneyDharma Server Running 🌱       ║
╠══════════════════════════════════════════════╣
║  Port:          ${String(PORT).padEnd(29)}║
║  Local:         http://localhost:${PORT}          ║
║  Health:        http://localhost:${PORT}/api/health║
║  Database:      MongoDB Atlas ✅              ║
║  Environment:   ${(process.env.NODE_ENV || "development").padEnd(29)}║
║  CORS Origins:  ${String(allowedOrigins.length).padEnd(29)}║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error("════════════════════════════════════");
    console.error("❌ SERVER STARTUP FAILED");
    console.error("════════════════════════════════════");
    console.error("Error:", err.message);
    console.error("");
    console.error("Common fixes:");
    console.error("  1. Check .env file exists with MONGODB_URI");
    console.error("  2. Check MongoDB Atlas IP whitelist (add 0.0.0.0/0)");
    console.error("  3. Check internet connection");
    console.error("  4. Run: npm install");
    console.error("════════════════════════════════════");
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

// ✅ Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received. Shutting down gracefully...");
  mongoose.connection.close(false, () => {
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  });
});

startServer();

module.exports = app;
