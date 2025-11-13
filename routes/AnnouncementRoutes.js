import express from "express";
import Announcement from "../models/Announcement.js";
import verifyToken from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// POST: Create an announcement
router.post("/", verifyToken, async (req, res) => {
  try {
    console.log("[POST] /api/announcements — Request received");

    const { title, message, societyId } = req.body;

    if (req.user.role !== "admin") {
      console.warn(
        "[WARN] Unauthorized attempt to create announcement by:",
        req.user.email
      );
      return res
        .status(403)
        .json({ message: "Only admins can create announcements" });
    }

    if (!societyId) {
      console.warn("[WARN] Missing societyId in request body");
      return res
        .status(400)
        .json({ message: "societyId is required to post announcement" });
    }

    const society = await User.findById(societyId);
    if (!society || society.role !== "society") {
      console.warn(`[WARN] Invalid or missing society: ${societyId}`);
      return res.status(404).json({ message: "Society not found" });
    }

    const newAnnouncement = new Announcement({
      title,
      message,
      authorId: society._id,
      authorRole: "society",
    });

    await newAnnouncement.save();
    console.log(
      `[INFO] Announcement created successfully — ID: ${newAnnouncement._id}`
    );

    res.status(201).json({
      message: "Announcement created successfully",
      announcement: newAnnouncement,
    });
  } catch (err) {
    console.error("[ERROR] Failed to create announcement:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: Fetch all announcements
router.get("/", async (req, res) => {
  try {
    console.log("[GET] /api/announcements — Fetching all announcements");
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate("authorId", "name email");

    console.log(`[INFO] Retrieved ${announcements.length} announcements`);
    res.json(announcements);
  } catch (err) {
    console.error("[ERROR] Failed to fetch announcements:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
