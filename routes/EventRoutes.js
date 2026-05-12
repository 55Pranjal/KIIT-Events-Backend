import express from "express";
import Event from "../models/Event.js";
import verifyToken from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Society from "../models/Society.js";
import Register from "../models/Register.js";
import Highlight from "../models/Highlight.js";
import { validate } from "../middleware/validate.js";
import { createEventSchema, updateEventSchema } from "../schemas/index.js";

const router = express.Router();

/**
 * Resolve the Society._id that a given user is allowed to act on.
 * - admin: any society they pass in (caller checks)
 * - society: the approved Society doc where they are president
 * Returns null if the society user has no approved society on file.
 */
const resolveOwnedSocietyId = async (userId) => {
  const society = await Society.findOne({
    president: userId,
    requestStatus: "approved",
  }).select("_id");
  return society ? society._id : null;
};

/**
 * Validate an event date/time against the same window the UI enforces:
 * parseable, in the future, and no more than 2 months out.
 * Returns { ok: true } or { ok: false, message }.
 */
const validateEventDateTime = (date, time) => {
  if (!date) return { ok: false, message: "date is required" };

  const start = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(start.getTime())) {
    return { ok: false, message: "Invalid date/time format" };
  }

  if (start.getTime() <= Date.now()) {
    return { ok: false, message: "Event date/time must be in the future" };
  }

  const twoMonthsOut = new Date();
  twoMonthsOut.setMonth(twoMonthsOut.getMonth() + 2);
  if (start.getTime() > twoMonthsOut.getTime()) {
    return {
      ok: false,
      message: "Event date must be within the next 2 months",
    };
  }

  return { ok: true };
};

router.post("/add", verifyToken, validate(createEventSchema), async (req, res) => {
  try {
    console.info("[EventRoute] Received create request from", req.user.id, "role:", req.user.role);

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
    } = req.body;

    // Role gate: only admins and approved societies can create events
    if (req.user.role !== "admin" && req.user.role !== "society") {
      console.warn(
        `[EventRoute] Unauthorized create attempt by ${req.user.role} ${req.user.id}`
      );
      return res
        .status(403)
        .json({ message: "Only admins and approved societies can create events" });
    }

    // Decide which Society._id this event belongs to.
    // Society users can only create for their own society — ignore any client-supplied societyId.
    // Admins must pass societyId in the body.
    let societyId;
    if (req.user.role === "society") {
      societyId = await resolveOwnedSocietyId(req.user.id);
      if (!societyId) {
        console.warn(
          `[EventRoute] Society user ${req.user.id} has no approved society`
        );
        return res
          .status(403)
          .json({ message: "No approved society found for this account" });
      }
    } else {
      societyId = req.body.societyId;
      if (!societyId) {
        return res
          .status(400)
          .json({ message: "societyId is required" });
      }
    }

    const dateCheck = validateEventDateTime(date, time);
    if (!dateCheck.ok) {
      return res.status(400).json({ message: dateCheck.message });
    }

    const society = await Society.findById(societyId).select(
      "_id name email phone"
    );
    if (!society) {
      console.warn("[EventRoute] Provided societyId not found:", societyId);
      return res.status(400).json({ message: "Provided societyId not found" });
    }

    // Build event explicitly (avoid relying on req.body spreading in case of whitelist)
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

    // Populate societyId for immediate client consumption
    const populated = await Event.findById(newEvent._id)
      .populate({ path: "societyId", select: "name email phone" })
      .lean();

    console.info("[EventRoute] saved event:", newEvent._id);
    return res
      .status(201)
      .json({ message: "Event saved successfully", event: populated });
  } catch (err) {
    console.error("[EventRoute] Error creating event:", err);
    return res
      .status(500)
      .json({ message: "Server error creating event", error: err.message });
  }
});

/**
 * @route   GET /
 * @desc    Get all events
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const now = new Date();

    // Get all events with society name
    const events = await Event.find().populate("societyId", "name").lean();

    // Filter based on real date + time
    const filteredEvents = events.filter((event) => {
      const eventDateTime = new Date(`${event.date} ${event.time}`);
      return eventDateTime > now;
    });

    // Sort the events by date+time
    filteredEvents.sort((a, b) => {
      const aDateTime = new Date(`${a.date} ${a.time}`);
      const bDateTime = new Date(`${b.date} ${b.time}`);
      return aDateTime - bDateTime;
    });

    console.log(
      `📦 [EventRoute] Returned ${filteredEvents.length} filtered future events`
    );

    res.json(filteredEvents);
  } catch (err) {
    console.error("❌ [EventRoute] Error fetching all events:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const events = await Event.find().populate("societyId", "name").lean();

    res.json(events);
  } catch (err) {
    console.error(err);
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
    const now = new Date();

    // Fetch all upcoming events by status
    const events = await Event.find({ registrationStatus: "upcoming" });

    // Filter events based on actual date + time
    const upcomingEvents = events.filter((event) => {
      const eventDateTime = new Date(`${event.date} ${event.time}`);
      return eventDateTime > now;
    });

    // Sort after filtering
    upcomingEvents.sort((a, b) => {
      const aDate = new Date(`${a.date} ${a.time}`);
      const bDate = new Date(`${b.date} ${b.time}`);
      return aDate - bDate;
    });

    console.log(
      `📅 [EventRoute] Returned ${upcomingEvents.length} upcoming future events`
    );

    res.json(upcomingEvents);
  } catch (err) {
    console.error("❌ [EventRoute] Error fetching upcoming events:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/past", async (req, res) => {
  try {
    const now = new Date();

    // Fetch all events (or only upcoming ones if you stored status)
    const events = await Event.find().populate("societyId", "name").lean();

    // Filter past events
    const pastEvents = events.filter((event) => {
      const eventDateTime = new Date(`${event.date} ${event.time}`);
      return eventDateTime < now;
    });

    // Sort descending (most recent past event first)
    pastEvents.sort((a, b) => {
      const aDateTime = new Date(`${a.date} ${a.time}`);
      const bDateTime = new Date(`${b.date} ${b.time}`);
      return bDateTime - aDateTime;
    });

    console.log(`⏳ [EventRoute] Returned ${pastEvents.length} past events`);

    res.json(pastEvents);
  } catch (err) {
    console.error("❌ [EventRoute] Error fetching past events:", err.message);
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

    if (req.user.role !== "admin") {
      if (req.user.role !== "society") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const ownedSocietyId = await resolveOwnedSocietyId(req.user.id);
      if (
        !ownedSocietyId ||
        !event.societyId ||
        event.societyId.toString() !== ownedSocietyId.toString()
      ) {
        console.warn(
          `🚫 [EventRoute] Unauthorized delete attempt by user ${req.user.id}`
        );
        return res.status(403).json({ message: "Unauthorized" });
      }
    }

    // Collect registered users so we can notify them after deletion.
    const registrations = await Register.find({ eventId: req.params.id })
      .select("userId")
      .lean();

    // Cascade: remove dependent rows so we don't leave orphaned registrations
    // or highlights pointing at a non-existent event.
    await Promise.all([
      Register.deleteMany({ eventId: req.params.id }),
      Highlight.deleteMany({ eventId: req.params.id }),
      Event.findByIdAndDelete(req.params.id),
    ]);

    if (registrations.length > 0) {
      const message = `The event "${event.title}" has been cancelled.`;
      const notifications = registrations.map((r) => ({
        userId: r.userId,
        message,
      }));
      // Best-effort — don't fail the delete if notifications can't be created.
      try {
        await Notification.insertMany(notifications);
      } catch (notifyErr) {
        console.error(
          "[EventRoute] Failed to notify registered users on delete:",
          notifyErr.message
        );
      }
    }

    console.log(
      `🗑️ [EventRoute] Event ${req.params.id} deleted (notified ${registrations.length} users, cleaned dependents)`
    );
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
router.put("/:eventId", verifyToken, validate(updateEventSchema), async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      console.warn(`⚠️ [EventRoute] Event not found (ID: ${eventId})`);
      return res.status(404).json({ message: "Event not found" });
    }

    if (req.user.role === "society") {
      const ownedSocietyId = await resolveOwnedSocietyId(req.user.id);
      if (
        !ownedSocietyId ||
        !event.societyId ||
        event.societyId.toString() !== ownedSocietyId.toString()
      ) {
        console.warn(
          `🚫 [EventRoute] Unauthorized update attempt by user ${req.user.id}`
        );
        return res
          .status(403)
          .json({ message: "You are not allowed to edit this event" });
      }
    } else if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You are not allowed to edit this event" });
    }

    // If date or time is being changed, validate the new combination.
    if (updates.date !== undefined || updates.time !== undefined) {
      const newDate = updates.date !== undefined ? updates.date : event.date;
      const newTime = updates.time !== undefined ? updates.time : event.time;
      const dateCheck = validateEventDateTime(newDate, newTime);
      if (!dateCheck.ok) {
        return res.status(400).json({ message: dateCheck.message });
      }
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

    // Track which user-visible fields actually changed so we can decide whether
    // to notify registered students. Cosmetic edits (description, image, guest)
    // don't warrant a notification.
    const notifiableFields = ["title", "date", "time", "location"];
    const changedNotifiable = [];
    allowedFields.forEach((field) => {
      if (updates[field] === undefined) return;
      if (notifiableFields.includes(field) && event[field] !== updates[field]) {
        changedNotifiable.push(field);
      }
      event[field] = updates[field];
    });

    await event.save();

    if (changedNotifiable.length > 0) {
      const registrations = await Register.find({ eventId })
        .select("userId")
        .lean();
      if (registrations.length > 0) {
        const message = `The event "${event.title}" was updated (${changedNotifiable.join(", ")}). Check the latest details.`;
        const notifications = registrations.map((r) => ({
          userId: r.userId,
          message,
          link: `/events/${eventId}`,
        }));
        try {
          await Notification.insertMany(notifications);
        } catch (notifyErr) {
          console.error(
            "[EventRoute] Failed to notify registered users on update:",
            notifyErr.message
          );
        }
      }
    }
    console.log(`🛠️ [EventRoute] Event ${eventId} updated successfully`);
    res.json({ message: "Event updated successfully", event });
  } catch (err) {
    console.error("❌ [EventRoute] Error updating event:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
