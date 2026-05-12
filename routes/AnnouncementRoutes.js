import express from "express";
import Announcement from "../models/Announcement.js";
import verifyToken from "../middleware/auth.js";
import User from "../models/User.js";
import Society from "../models/Society.js"; // <--- new import (adjust path if needed)
import Notification from "../models/Notification.js";
import { mutationLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { createAnnouncementSchema } from "../schemas/index.js";

const router = express.Router();

// POST: Create an announcement (admin or approved society)
router.post(
  "/",
  mutationLimiter,
  verifyToken,
  validate(createAnnouncementSchema),
  async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "society") {
      return res
        .status(403)
        .json({ message: "Only admins and approved societies can post announcements" });
    }

    // zod has already trimmed and validated; safe to read directly.
    const { title, message } = req.body;

    // Resolve which Society this post is attributed to.
    // - society users: their own approved Society (ignore client societyId)
    // - admins: must pick a Society via the dropdown
    let societyId;
    if (req.user.role === "society") {
      const society = await Society.findOne({
        president: req.user.id,
        requestStatus: "approved",
      }).select("_id");
      if (!society) {
        return res
          .status(403)
          .json({ message: "No approved society found for this account" });
      }
      societyId = society._id;
    } else {
      societyId = req.body.societyId;
      if (!societyId) {
        return res
          .status(400)
          .json({ message: "societyId is required" });
      }
      const society = await Society.findById(societyId).select("_id");
      if (!society) {
        return res
          .status(400)
          .json({ message: "Provided societyId not found" });
      }
    }

    // We store Society._id in authorId — the GET handler resolves it from
    // either the User or Society collection, so this stays consistent.
    const announcement = await Announcement.create({
      title,
      message,
      authorId: societyId,
      authorRole: "society",
    });

    // Resolve the society's display name for the notification body.
    const societyDoc = await Society.findById(societyId).select("name").lean();
    const societyName = societyDoc?.name || "A society";

    // Fan out notifications to every student (broadcast). Best-effort: a
    // notification failure shouldn't fail the announcement create. We exclude
    // the author themselves so a society poster doesn't get pinged about
    // their own post.
    try {
      const recipients = await User.find({
        role: "student",
        _id: { $ne: req.user.id },
      })
        .select("_id")
        .lean();

      if (recipients.length > 0) {
        const notifMessage = `${societyName} posted: "${title}"`;
        const notifications = recipients.map((u) => ({
          userId: u._id,
          message: notifMessage,
          link: `/AnnouncementsList`,
        }));
        await Notification.insertMany(notifications);
        console.info(
          `[INFO] Fanned out announcement ${announcement._id} to ${recipients.length} students`
        );
      }
    } catch (notifyErr) {
      console.error(
        "[WARN] Failed to fan out announcement notifications:",
        notifyErr.message
      );
    }

    console.info(
      `[INFO] Announcement ${announcement._id} created by ${req.user.role} ${req.user.id} for society ${societyId}`
    );
    res.status(201).json(announcement);
  } catch (err) {
    console.error("[ERROR] Failed to create announcement:", err.message);
    res.status(500).json({ message: "Server error while creating announcement" });
  }
});

// POST: Create an announcement
router.get("/", async (req, res) => {
  try {
    console.log("[GET] /api/announcements — Fetching all announcements");

    // fetch raw announcements (no populate) — we'll resolve authors ourselves
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean();

    // If no announcements, return early
    if (!announcements || announcements.length === 0) {
      console.log("[INFO] No announcements found");
      return res.json([]);
    }

    // collect unique authorIds to reduce DB hits
    const authorIds = Array.from(
      new Set(
        announcements
          .map((a) => (a.authorId ? String(a.authorId) : null))
          .filter(Boolean)
      )
    );

    const usersById = {};
    const societiesById = {};

    if (authorIds.length > 0) {
      // fetch all possible matching users and societies in parallel
      const [users, societies] = await Promise.all([
        User.find({ _id: { $in: authorIds } })
          .select("_id name email")
          .lean(),
        Society.find({ _id: { $in: authorIds } })
          .select("_id name email")
          .lean(),
      ]);

      users.forEach((u) => {
        usersById[String(u._id)] = u;
      });
      societies.forEach((s) => {
        societiesById[String(s._id)] = s;
      });
    }

    // Attach an `author` object to each announcement for predictable frontend use
    const enriched = announcements.map((a) => {
      const authorIdStr = a.authorId ? String(a.authorId) : null;
      let author = null;
      let authorSource = null;

      // if authorId was already populated as an object with a name, prefer that
      if (a.authorId && typeof a.authorId === "object" && a.authorId.name) {
        author = {
          _id: a.authorId._id ?? a.authorId,
          name: a.authorId.name,
          email: a.authorId.email,
        };
        authorSource = "populated";
      } else if (authorIdStr && usersById[authorIdStr]) {
        author = usersById[authorIdStr];
        authorSource = "user";
      } else if (authorIdStr && societiesById[authorIdStr]) {
        author = societiesById[authorIdStr];
        authorSource = "society";
      }

      return {
        ...a,
        author: author
          ? {
              _id: author._id,
              name: author.name,
              email: author.email,
              source: authorSource,
            }
          : null,
      };
    });

    console.log(
      `[INFO] Retrieved ${enriched.length} announcements (authors resolved)`
    );

    return res.json(enriched);
  } catch (err) {
    console.error("[ERROR] Failed to fetch announcements:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
