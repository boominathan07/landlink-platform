require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const { initSocket } = require("./services/socketService");
const { registerSocketHandlers } = require("./socket/handlers");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const settingsRoutes = require("./routes/settingsRoutes");
const plotRoutes = require("./routes/plots");
const bookingRoutes = require("./routes/bookings");
const documentRoutes = require("./routes/documents");
const notificationRoutes = require("./routes/notifications");
const subscriptionRoutes = require("./routes/subscription");
const analyticsRoutes = require("./routes/analytics");
const { warmupPaddleOcrCache } = require("./services/ocrService");

const app = express();
const server = http.createServer(app);

/* -------------------- Allowed Origins -------------------- */

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

function buildAllowedOrigins() {
  const defaults = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://landlink-platform.vercel.app",
  ];

  const fromEnv = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((entry) => String(entry).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set([...defaults.map(normalizeOrigin), ...fromEnv])];
}

const allowedOrigins = buildAllowedOrigins();

function corsOrigin(origin, callback) {
  // Postman, mobile apps, server-to-server (no Origin header)
  if (!origin) return callback(null, true);

  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized)) {
    // Reflect exact origin (required when credentials: true; never use "*")
    return callback(null, normalized);
  }

  return callback(new Error(`Origin ${origin} not allowed by CORS`));
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
  optionsSuccessStatus: 204,
};

/* -------------------- CORS -------------------- */

app.use(cors(corsOptions));
// Express 5: explicit preflight handler (app.options("*") is not supported)
app.options(/.*/, cors(corsOptions));

/* -------------------- Socket.IO -------------------- */

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: corsOptions.allowedHeaders,
  },
});

initSocket(io);
registerSocketHandlers(io);

/* -------------------- Middleware -------------------- */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------- Static Uploads -------------------- */

const uploadsDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

/* -------------------- Health Check -------------------- */

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LandLink Backend Running",
  });
});

/* -------------------- API Routes -------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/user", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/plots", plotRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/analytics", analyticsRoutes);

/* -------------------- 404 Handler -------------------- */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* -------------------- Error Handler -------------------- */

app.use((err, req, res, next) => {
  console.error(err);

  if (err.message.includes("CORS")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* -------------------- Database -------------------- */

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      setImmediate(() => {
        warmupPaddleOcrCache().catch((err) => {
          console.warn("[ocr] Startup warmup skipped:", err.message);
        });
      });
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed");
    console.error(err.message);
    process.exit(1);
  });