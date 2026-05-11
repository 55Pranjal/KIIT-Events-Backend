import express from "express";
import User from "../models/User.js";
import Society from "../models/Society.js";
import Event from "../models/Event.js";
import Register from "../models/Register.js";
import verifyToken from "../middleware/auth.js";
import { mutationLimiter } from "../middleware/rateLimiters.js";
import mongoose from "mongoose";

const router = express.Router();

// =============================
// 📝 Request to Create a Society
// =============================
router.post("/request", mutationLimiter, verifyToken, async (req, res) => {
  try {
    console.info(
      "[POST] /api/societies/request - New society request received"
    );

    const { name, description, email, phone } = req.body;
    console.debug("[DEBUG] Society request body:", { name, email, phone });

    const user = await User.findById(req.user.id);
    if (!user) {
      console.warn(
        `[WARN] Society request by non-existing user: ${req.user.id}`
      );
      return res.status(404).json({ error: "User not found" });
    }

    const newSociety = new Society({
      name,
      description,
      email,
      phone,
      president: user._id,
      requestStatus: "pending",
    });

    await newSociety.save();
    user.societyRequestStatus = "pending";
    await user.save();

    console.info(`[INFO] Society request created by user ${user.email}`);
    res.status(201).json({ message: "Society request sent!" });
  } catch (err) {
    console.error("[ERROR] Failed to send society request:", err.message);
    res
      .status(500)
      .json({ error: "Server error while sending society request" });
  }
});

// =============================
// 🎫 Get Society or Admin Events
// =============================
router.get("/my-events", verifyToken, async (req, res) => {
  try {
    console.info(
      `[GET] /api/societies/my-events - Fetching events for ${req.user.role}`
    );

    let events = [];

    if (req.user.role === "society") {
      // Resolve the Society._id this user is president of — events reference
      // Society._id, not User._id, so we must look it up before querying.
      const society = await Society.findOne({
        president: new mongoose.Types.ObjectId(req.user.id),
        requestStatus: "approved",
      }).select("_id");

      if (!society) {
        console.warn(
          `[WARN] /my-events: no approved society for user ${req.user.id}`
        );
        return res.json([]);
      }

      events = await Event.find({ societyId: society._id });
    } else if (req.user.role === "admin") {
      events = await Event.find();
    } else {
      console.warn("[WARN] Unauthorized attempt to access /my-events");
      return res.status(403).json({ message: "Access denied" });
    }

    const eventsWithRegistrations = await Promise.all(
      events.map(async (event) => {
        const registrations = await Register.find({
          eventId: event._id,
        }).populate("userId", "name email");
        return { ...event.toObject(), registrations };
      })
    );

    console.info(`[INFO] Fetched ${eventsWithRegistrations.length} events`);
    res.json(eventsWithRegistrations);
  } catch (err) {
    console.error("[ERROR] Failed to fetch society events:", err.message);
    res.status(500).json({ message: "Server error while fetching events" });
  }
});

// =============================
// 👤 Get Society Profile
// =============================
router.get("/me", verifyToken, async (req, res) => {
  try {
    console.info(
      `[GET] /api/societies/me - Fetching profile for user ${req.user.id}`
    );

    if (req.user.role !== "society") {
      console.warn(`[WARN] Unauthorized access attempt by ${req.user.role}`);
      return res.status(403).json({ message: "Unauthorized" });
    }

    const society = await Society.findOne({
      president: new mongoose.Types.ObjectId(req.user.id),
    }).populate("president", "name email");

    if (!society) {
      console.warn(`[WARN] Society not found for user: ${req.user.id}`);
      return res.status(404).json({ message: "Society not found" });
    }

    console.info(`[INFO] Society profile fetched for: ${society.name}`);
    res.json(society);
  } catch (err) {
    console.error("[ERROR] Failed to fetch society profile:", err.message);
    res.status(500).json({ message: "Server error while fetching society" });
  }
});

// =============================
// ✏️ Update Society Profile
// =============================
router.put("/me", mutationLimiter, verifyToken, async (req, res) => {
  try {
    console.info(
      `[PUT] /api/societies/me - Updating profile for user ${req.user.id}`
    );

    if (req.user.role !== "society") {
      console.warn(`[WARN] Unauthorized update attempt by ${req.user.role}`);
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updateFields = req.body;
    console.debug("[DEBUG] Update fields:", updateFields);

    const society = await Society.findOneAndUpdate(
      { president: new mongoose.Types.ObjectId(req.user.id) },
      updateFields,
      { new: true }
    ).populate("president", "name email");

    if (!society) {
      console.warn(`[WARN] Society not found for update: ${req.user.id}`);
      return res.status(404).json({ message: "Society not found" });
    }

    console.info(
      `[INFO] Society profile updated successfully for: ${society.name}`
    );
    res.json(society);
  } catch (err) {
    console.error("[ERROR] Failed to update society profile:", err.message);
    res.status(500).json({ message: "Server error while updating society" });
  }
});

// =============================
// 👤 Get Society Profile by ID (admin or owning society)
// =============================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const society = await Society.findById(id).populate(
      "president",
      "name email"
    );
    if (!society) {
      return res.status(404).json({ message: "Society not found" });
    }

    // Admin can view any society. The society's own president can view theirs.
    // Anyone else is forbidden (we don't want students enumerating societies
    // through this endpoint — public listings live under /api/users).
    const isAdmin = req.user.role === "admin";
    const isOwnPresident =
      req.user.role === "society" &&
      society.president &&
      society.president._id.toString() === req.user.id;

    if (!isAdmin && !isOwnPresident) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(society);
  } catch (err) {
    console.error("[ERROR] Failed to fetch society by id:", err.message);
    res.status(500).json({ message: "Server error while fetching society" });
  }
});

// =============================
// ✏️ Update Society Profile by ID (admin only)
// =============================
router.put("/:id", mutationLimiter, verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const allowed = ["name", "description", "email", "phone"];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const society = await Society.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate("president", "name email");

    if (!society) {
      return res.status(404).json({ message: "Society not found" });
    }

    console.info(
      `[INFO] Society ${society._id} updated by admin ${req.user.id}`
    );
    res.json(society);
  } catch (err) {
    console.error("[ERROR] Failed to admin-update society:", err.message);
    res.status(500).json({ message: "Server error while updating society" });
  }
});

export default router;
