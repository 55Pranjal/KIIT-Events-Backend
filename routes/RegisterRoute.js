import express from "express";
import Register from "../models/Register.js";
import Event from "../models/Event.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// ✅ Sync indexes once at startup
const createIndexes = async () => {
  try {
    await Register.syncIndexes();
    console.log("✅ [RegisterRoute] Indexes synced successfully.");
  } catch (err) {
    console.error("❌ [RegisterRoute] Error syncing indexes:", err.message);
  }
};

createIndexes();

/**
 * @route   POST /:eventId
 * @desc    Register a user for an event
 * @access  Private (Student only)
 */
router.post("/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      id: userId,
      role: userRole,
      email: userEmail,
      name: userName,
    } = req.user;

    if (userRole === "society" || userRole === "admin") {
      console.warn(
        `⚠️ [RegisterRoute] Forbidden registration attempt by ${userRole}: ${userId}`
      );
      return res.status(403).json({
        message: "Society and admin accounts cannot register for events.",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      console.warn(`⚠️ [RegisterRoute] Event not found: ${eventId}`);
      return res.status(404).json({ message: "Event not found" });
    }

    const existing = await Register.findOne({ userId, eventId });
    if (existing) {
      console.info(
        `ℹ️ [RegisterRoute] User ${userId} already registered for ${eventId}`
      );
      return res
        .status(400)
        .json({ message: "Already registered for this event" });
    }

    const registration = new Register({ userId, eventId });
    await registration.save();

    const Notification = (await import("../models/Notification.js")).default;
    const notification = new Notification({
      userId,
      message: `You have successfully registered for "${event.title}".`,
      isRead: false,
    });
    await notification.save();

    console.log(
      `✅ [RegisterRoute] User ${userId} registered for "${event.title}"`
    );

    res.status(201).json({
      message: "Registered successfully",
      registration,
      notification,
    });
  } catch (err) {
    console.error("❌ [RegisterRoute] Registration error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /my
 * @desc    Get all events a user has registered for
 * @access  Private
 */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const registrations = await Register.find({ userId: req.user.id })
      .populate("eventId")
      .lean();

    const events = registrations.filter((r) => r.eventId).map((r) => r.eventId);

    console.log(
      `📦 [RegisterRoute] Fetched ${events.length} registered events for user ${req.user.id}`
    );
    res.json(events);
  } catch (err) {
    console.error(
      "❌ [RegisterRoute] Error fetching user events:",
      err.message
    );
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /:eventId/registrations
 * @desc    Get all registrations for a specific event
 * @access  Private (Society/Admin)
 */
router.get("/:eventId/registrations", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      console.warn(`⚠️ [RegisterRoute] Event not found: ${eventId}`);
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role === "society" &&
      event.societyId?.toString() !== req.user.id
    ) {
      console.warn(
        `⚠️ [RegisterRoute] Unauthorized access attempt by society ${req.user.id} for event ${eventId}`
      );
      return res.status(403).json({ message: "Forbidden" });
    }

    const registrations = await Register.find({ eventId }).populate(
      "userId",
      "name email"
    );

    console.log(
      `📋 [RegisterRoute] ${registrations.length} registrations fetched for event ${eventId}`
    );
    res.status(200).json(registrations);
  } catch (err) {
    console.error(
      "❌ [RegisterRoute] Error in GET /:eventId/registrations:",
      err.message
    );
    res.status(500).json({ message: err.message });
  }
});

export default router;
