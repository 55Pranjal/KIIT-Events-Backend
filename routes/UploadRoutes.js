import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import verifyToken from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// use memory storage, not disk
const upload = multer({ storage: multer.memoryStorage() });

// configure cloudinary
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

// Upload route
router.post(
  "/",
  uploadLimiter,
  verifyToken,
  requireOrganizer,
  upload.single("poster"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // upload to cloudinary using a stream
      const streamUpload = () => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "event_posters",
              resource_type: "image",
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };

      const result = await streamUpload();

      // return the secure URL
      return res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Cloudinary Upload Error:", err);
      res.status(500).json({ error: "Image upload failed" });
    }
  }
);

export default router;
