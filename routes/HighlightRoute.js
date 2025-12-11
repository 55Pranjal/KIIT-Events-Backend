// routes/highlights.js
import express from "express";
const router = express.Router();

import Highlight from "../models/Highlight.js";
import Event from "../models/Event.js";
import verifyToken from "../middleware/auth.js";

// create highlight for an event
router.post(
  "/events/:eventId/create-highlights",
  verifyToken, // user must be logged in
  async (req, res) => {
    // 🔐 Admin check
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { eventId } = req.params;
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const payload = req.body;
      payload.eventId = eventId;

      if (
        !payload.title ||
        !payload.shortDescription ||
        !Array.isArray(payload.gallery) ||
        payload.gallery.length === 0
      ) {
        return res.status(400).json({
          error:
            "title, shortDescription and at least one gallery image are required",
        });
      }

      const newHighlight = new Highlight(payload);
      await newHighlight.save();

      res.status(201).json(newHighlight);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.get("/events/:eventId/highlights", async (req, res) => {
  try {
    const { eventId } = req.params;
    // optional: check event exists
    // const event = await Event.findById(eventId);
    // if (!event) return res.status(404).json({ error: "Event not found" });

    const highlights = await Highlight.find({ eventId, status: "published" })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ highlights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default router;
