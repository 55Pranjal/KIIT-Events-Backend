// import dotenv from "dotenv";
// dotenv.config();

// import express from "express";
// import cors from "cors";
// import jwt from "jsonwebtoken";
// import mongoose from "mongoose";

// import userRoutes from "./routes/UserRoutes.js";
// import eventRoutes from "./routes/EventRoutes.js";
// import registerRoutes from "./routes/RegisterRoute.js";
// import societyRoutes from "./routes/SocietyRoutes.js";
// import adminRoutes from "./routes/AdminRoutes.js";
// import notificationRoutes from "./routes/NotificationRoutes.js";
// import announcementRoutes from "./routes/AnnouncementRoutes.js";
// import queryRoutes from "./routes/queryRoutes.js";
// import path from "path";
// import uploadRoutes from "./routes/UploadRoutes.js";
// import adminSocietyRoutes from "./routes/adminSocietyRoutes.js";

// const app = express();

// // ====== Middleware ======
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// const uploadDir = path.join(process.cwd(), "uploads");
// app.use("/uploads", express.static(uploadDir));

// // ✅ Fix: Explicitly allow your frontend origin
// app.use(
//   cors({
//     origin: ["https://kiitevents.netlify.app", "http://localhost:5173"], // your Netlify frontend
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
//   })
// );

// // ====== Environment Variables ======
// const { JWT_SECRET, MONGO_URI, PORT = 5000 } = process.env;

// if (!JWT_SECRET || !MONGO_URI) {
//   console.error("[ERROR] Missing environment variables. Check your .env file.");
//   process.exit(1);
// }

// // ====== Routes ======
// app.get("/", (req, res) => {
//   res.send("Backend is running successfully ✅");
// });

// app.get("/api/protected", (req, res) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader) return res.status(401).json({ msg: "No token provided" });

//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     res.json({ msg: "Protected data", user: decoded });
//   } catch {
//     res.status(401).json({ msg: "Invalid or expired token" });
//   }
// });

// app.use("/api/users", userRoutes);
// app.use("/api/events", eventRoutes);
// app.use("/api/registers", registerRoutes);
// app.use("/api/societies", societyRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/announcements", announcementRoutes);
// app.use("/api/queries", queryRoutes);
// app.use("/api/upload", uploadRoutes);
// app.use("/api/adminSociety", adminSocietyRoutes);

// // ====== Database Connection ======
// mongoose
//   .connect(MONGO_URI)
//   .then(() => console.info("[INFO] ✅ MongoDB connected successfully"))
//   .catch((err) =>
//     console.error("[ERROR] ❌ MongoDB connection failed:", err.message)
//   );

// // ====== Server ======
// app.listen(PORT, () => {
//   console.info(`[INFO] 🚀 Server running on port ${PORT}`);
// });

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
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

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const app = express();

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

// ✅ Fix: Explicitly allow your frontend origin
app.use(
  cors({
    origin: ["https://kiitevents.netlify.app", "http://localhost:5173"], // your Netlify frontend
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// ====== Environment Variables ======
const { JWT_SECRET, MONGO_URI, PORT = 5000 } = process.env;

if (!JWT_SECRET || !MONGO_URI) {
  console.error("[ERROR] Missing environment variables. Check your .env file.");
  process.exit(1);
}

// ====== Routes ======
app.get("/", (req, res) => {
  res.send("Backend is running successfully ✅");
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
