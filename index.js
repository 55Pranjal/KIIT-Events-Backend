import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import userRoutes from "./routes/UserRoutes.js";
import eventRoutes from "./routes/EventRoutes.js";
import registerRoutes from "./routes/RegisterRoute.js";
import societyRoutes from "./routes/SocietyRoutes.js";
import adminRoutes from "./routes/AdminRoutes.js";
import notificationRoutes from "./routes/NotificationRoutes.js";
import announcementRoutes from "./routes/AnnouncementRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";
import path from "path";
import uploadRoutes from "./routes/UploadRoutes.js";
import adminSocietyRoutes from "./routes/adminSocietyRoutes.js";
import HighlightRoutes from "./routes/HighlightRoute.js";
import { globalApiLimiter } from "./middleware/rateLimiters.js";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const app = express();

// Required when running behind a reverse proxy (Render, Heroku, Fly, etc.)
// so req.ip reflects the real client IP from X-Forwarded-For. Without this,
// every user shares the proxy's IP and rate limits become global.
app.set("trust proxy", 1);

// ====== Security Headers ======
// Helmet sets a sensible baseline of security headers (HSTS, X-Content-Type-Options,
// Referrer-Policy, etc.). We relax Cross-Origin-Resource-Policy because /uploads
// images are embedded by the frontend on a different origin (Netlify).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ====== CORS ======
// Allowed origins are env-driven so we can add a custom domain without code changes.
// In development, localhost is always allowed regardless of env.
const isProd = process.env.NODE_ENV === "production";
const ENV_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];
// Fallback prod origin so a missing env var doesn't take the site down.
const PROD_FALLBACK = ["https://kiitevents.netlify.app"];

const allowedOrigins = isProd
  ? (ENV_ORIGINS.length ? ENV_ORIGINS : PROD_FALLBACK)
  : [...DEV_ORIGINS, ...ENV_ORIGINS];

console.info("[INFO] CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin / curl / mobile / server-to-server. Allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[WARN] CORS rejected origin: ${origin}`);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make uploads path deterministic (use path relative to this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadDir = resolve(__dirname, "uploads"); // adjust to "../uploads" if server file is in a subfolder

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.info("[INFO] Using uploadDir:", uploadDir);

app.use("/uploads", express.static(uploadDir));

// ====== Environment Variables ======
const { JWT_SECRET, MONGO_URI, PORT = 5000 } = process.env;

if (!JWT_SECRET || !MONGO_URI) {
  console.error("[ERROR] Missing environment variables. Check your .env file.");
  process.exit(1);
}

// Apply a soft global rate limit to all /api/* routes as defense-in-depth.
// Specific routes layer tighter limits on top of this.
app.use("/api", globalApiLimiter);

// ====== Routes ======
app.get("/", (req, res) => {
  res.send("Backend is running successfully ✅");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/protected", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ msg: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ msg: "Protected data", user: decoded });
  } catch {
    res.status(401).json({ msg: "Invalid or expired token" });
  }
});

app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registers", registerRoutes);
app.use("/api/societies", societyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/adminSociety", adminSocietyRoutes);
app.use("/api", HighlightRoutes);

// ====== Database Connection ======
mongoose
  .connect(MONGO_URI)
  .then(() => console.info("[INFO] ✅ MongoDB connected successfully"))
  .catch((err) =>
    console.error("[ERROR] ❌ MongoDB connection failed:", err.message)
  );

// ====== Server ======
app.listen(PORT, () => {
  console.info(`[INFO] 🚀 Server running on port ${PORT}`);
});
