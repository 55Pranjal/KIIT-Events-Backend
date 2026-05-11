import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import verifyToken from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
// SVG is intentionally excluded — it can contain <script> and is an XSS vector
// when rendered inline anywhere on the frontend.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    const err = new Error(
      "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF."
    );
    err.code = "UNSUPPORTED_MEDIA_TYPE";
    return cb(err);
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Only authenticated organizers/admins should be able to upload posters.
// Unauthenticated upload was a real security/cost hole on Cloudinary.
const requireOrganizer = (req, res, next) => {
  if (req.user?.role === "society" || req.user?.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Only organizers can upload posters." });
};

// Wraps upload.single("poster") so multer's errors return clean JSON instead
// of propagating to Express's default HTML error handler.
const handleSingleUpload = (req, res, next) => {
  upload.single("poster")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `File too large. Maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err.code === "UNSUPPORTED_MEDIA_TYPE") {
      return res.status(415).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || "Upload failed." });
  });
};

router.post(
  "/",
  uploadLimiter,
  verifyToken,
  requireOrganizer,
  handleSingleUpload,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "event_posters",
              resource_type: "image",
              // Defence in depth: Cloudinary will reject anything that isn't
              // actually an image, even if a client lied about the MIME type.
              allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await streamUpload();
      return res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Cloudinary Upload Error:", err);
      const message =
        err?.message?.includes("not allowed") || err?.http_code === 400
          ? "Image rejected — make sure it's a valid JPEG, PNG, WebP, or GIF."
          : "Image upload failed";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
