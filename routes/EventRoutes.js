import express from "express";
import Event from "../models/Event.js";
import verifyToken from "../middleware/auth.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
// import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/**
 * @route   POST /add
 * @desc    Admin adds a new event and sends notifications to all users
 * @access  Private (Admin only)
 */
router.post("/add", verifyToken, async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      location,
      description,
      guest,
      registrationStatus,
      coverImageURL,
      eventCategory,
      societyId,
    } = req.body;

    console.log("📥 [EventRoute] Received new event creation request");

    if (req.user.role !== "admin") {
      console.warn(
        `⚠️ [EventRoute] Unauthorized attempt by user ${req.user.id}`
      );
      return res.status(403).json({ message: "Only admins can create events" });
    }

    if (!societyId) {
      console.warn(
        "⚠️ [EventRoute] Missing societyId in event creation request"
      );
      return res
        .status(400)
        .json({ message: "societyId is required to associate the event" });
    }

    const newEvent = new Event({
      title,
      date,
      time,
      location,
      description,
      guest,
      registrationStatus,
      coverImageURL,
      eventCategory,
      societyId,
    });

    await newEvent.save();
    console.log(
      `✅ [EventRoute] Event created successfully (ID: ${newEvent._id})`
    );

    const users = await User.find();
    console.log(`📋 [EventRoute] Found ${users.length} users to notify`);

    const notifications = users.map((user) => ({
      userId: user._id,
      message: `🎉 New event "${newEvent.title}" has been added!`,
      link: `/events/${newEvent._id}`,
    }));

    await Notification.insertMany(notifications);
    console.log("✅ [EventRoute] Notifications created for all users");

    // Uncomment if using email service later
    // const subject = "🎉 New Event Added!";
    // const text = `A new event "${newEvent.title}" has been added! Check it out on CollegeVents.`;
    // if (users.length > 0) {
    //   console.log(`📧 Sending emails to ${users.length} users...`);
    //   const emailPromises = users.map((user) =>
    //     sendEmail(user.email, subject, text).catch((err) =>
    //       console.error(`❌ Failed to send email to ${user.email}:`, err.message)
    //     )
    //   );
    //   await Promise.allSettled(emailPromises);
    //   console.log("✅ [EventRoute] Email notifications processed.");
    // }

    res.status(201).json({
      message: "Event saved successfully",
      event: newEvent,
    });
  } catch (err) {
    console.error("❌ [EventRoute] Error creating event:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   GET /
 * @desc    Get all events
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().populate("societyId", "name").lean();
    console.log(`📦 [EventRoute] Returned ${events.length} total events`);
    res.json(events);
  } catch (err) {
    console.error("❌ [EventRoute] Error fetching all events:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /upcoming
 * @desc    Get upcoming events (sorted by date)
 * @access  Public
 */
router.get("/upcoming", async (req, res) => {
  try {
    const events = await Event.find({ registrationStatus: "upcoming" }).sort({
      date: 1,
    });
    console.log(`📅 [EventRoute] Returned ${events.length} upcoming events`);
    res.json(events);
  } catch (err) {
    console.error(
      "❌ [EventRoute] Error fetching upcoming events:",
      err.message
    );
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /:id
 * @desc    Get details of a single event
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      console.warn(`⚠️ [EventRoute] Event not found (ID: ${req.params.id})`);
      return res.status(404).json({ message: "Event not found" });
    }

    console.log(`📄 [EventRoute] Returned details for event ${req.params.id}`);
    res.json(event);
  } catch (err) {
    console.error("❌ [EventRoute] Error fetching event:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @route   DELETE /:id
 * @desc    Delete an event
 * @access  Private (Admin or owning society)
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      console.warn(`⚠️ [EventRoute] Event not found (ID: ${req.params.id})`);
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      (!event.societyId || event.societyId.toString() !== req.user.id)
    ) {
      console.warn(
        `🚫 [EventRoute] Unauthorized delete attempt by user ${req.user.id}`
      );
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Event.findByIdAndDelete(req.params.id);
    console.log(`🗑️ [EventRoute] Event ${req.params.id} deleted successfully`);
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("❌ [EventRoute] Error deleting event:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PUT /:eventId
 * @desc    Update an event
 * @access  Private (Admin or owning society)
 */
router.put("/:eventId", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      console.warn(`⚠️ [EventRoute] Event not found (ID: ${eventId})`);
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role === "society" &&
      (!event.societyId || event.societyId.toString() !== req.user.id)
    ) {
      console.warn(
        `🚫 [EventRoute] Unauthorized update attempt by user ${req.user.id}`
      );
      return res
        .status(403)
        .json({ message: "You are not allowed to edit this event" });
    }

    const allowedFields = [
      "title",
      "date",
      "time",
      "location",
      "description",
      "guest",
      "registrationStatus",
      "coverImageURL",
      "eventCategory",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) event[field] = updates[field];
    });

    await event.save();
    console.log(`🛠️ [EventRoute] Event ${eventId} updated successfully`);
    res.json({ message: "Event updated successfully", event });
  } catch (err) {
    console.error("❌ [EventRoute] Error updating event:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
