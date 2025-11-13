import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Society from "../models/Society.js";
import Event from "../models/Event.js";
import Register from "../models/Register.js";
import verifyToken from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

// =============================
// 📝 Request to Create a Society
// =============================
router.post("/request", async (req, res) => {
  try {
    console.info(
      "[POST] /api/societies/request - New society request received"
    );

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn("[WARN] Missing Authorization header");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { name, description, email, phone } = req.body;
    console.debug("[DEBUG] Society request body:", { name, email, phone });

    const user = await User.findById(decoded.id);
    if (!user) {
      console.warn(
        `[WARN] Society request by non-existing user: ${decoded.id}`
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
      events = await Event.find({ societyId: req.user.id });
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
router.put("/me", verifyToken, async (req, res) => {
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

export default router;
