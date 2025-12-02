// routes/uploadRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// ensure uploads dir exists
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

// validate file type + limits
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB limit — change as needed
  fileFilter: (req, file, cb) => {
    const allowedMime = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMime.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (jpg, png, webp) are allowed"));
  },
});

router.post("/", upload.single("poster"), (req, res) => {
  console.info(
    "[UploadRoute] Received upload. file:",
    req.file && {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    }
  );
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // prefer a configured absolute base if you have one
  const BASE =
    process.env.BACKEND_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const url = `${BASE}/uploads/${req.file.filename}`;
  console.info("[UploadRoute] Responding with url:", url);
  return res.json({ url });
});

// optional: endpoint to delete files (admin use) - not required but useful
export default router;
