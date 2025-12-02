// import express from "express";
// import Announcement from "../models/Announcement.js";
// import verifyToken from "../middleware/auth.js";
// import User from "../models/User.js";

// const router = express.Router();

// // POST: Create an announcement
// router.post("/", verifyToken, async (req, res) => {
//   try {
//     console.log("[POST] /api/announcements — Request received");

//     const { title, message, societyId } = req.body;

//     if (req.user.role !== "admin") {
//       console.warn(
//         "[WARN] Unauthorized attempt to create announcement by:",
//         req.user.email
//       );
//       return res
//         .status(403)
//         .json({ message: "Only admins can create announcements" });
//     }

//     if (!societyId) {
//       console.warn("[WARN] Missing societyId in request body");
//       return res
//         .status(400)
//         .json({ message: "societyId is required to post announcement" });
//     }

//     const society = await User.findById(societyId);
//     if (!society || society.role !== "society") {
//       console.warn(`[WARN] Invalid or missing society: ${societyId}`);
//       return res.status(404).json({ message: "Society not found" });
//     }

//     const newAnnouncement = new Announcement({
//       title,
//       message,
//       authorId: society._id,
//       authorRole: "society",
//     });

//     await newAnnouncement.save();
//     console.log(
//       `[INFO] Announcement created successfully — ID: ${newAnnouncement._id}`
//     );

//     res.status(201).json({
//       message: "Announcement created successfully",
//       announcement: newAnnouncement,
//     });
//   } catch (err) {
//     console.error("[ERROR] Failed to create announcement:", err.message);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // GET: Fetch all announcements
// router.get("/", async (req, res) => {
//   try {
//     console.log("[GET] /api/announcements — Fetching all announcements");
//     const announcements = await Announcement.find()
//       .sort({ createdAt: -1 })
//       .populate("authorId", "name email");

//     console.log(`[INFO] Retrieved ${announcements.length} announcements`);
//     res.json(announcements);
//   } catch (err) {
//     console.error("[ERROR] Failed to fetch announcements:", err.message);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// export default router;

// routes/AnnouncementRoutes.js (replace existing file / handlers)
import express from "express";
import Announcement from "../models/Announcement.js";
import verifyToken from "../middleware/auth.js";
import User from "../models/User.js";
import Society from "../models/Society.js"; // <--- new import (adjust path if needed)

const router = express.Router();

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
