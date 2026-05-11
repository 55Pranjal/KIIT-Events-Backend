import express from "express";
import Notification from "../models/Notification.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   GET /
 * @desc    Fetch latest notifications for the logged-in user
 * @access  Private
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    // Pagination: ?limit=20&skip=40. Defaults match the previous hardcoded
    // behaviour (limit 50, skip 0). Clamped to keep payloads bounded.
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100
    );
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log(
      `📨 [NotificationRoute] Fetched ${notifications.length} notifications for user ${req.user.id} (skip=${skip}, limit=${limit})`
    );
    res.json(notifications);
  } catch (err) {
    console.error(
      "❌ [NotificationRoute] Error fetching notifications:",
      err.message
    );
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   PATCH /:id/read
 * @desc    Mark a notification as read/unread
 * @access  Private
 */
router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: isRead !== undefined ? isRead : true },
      { new: true }
    );

    if (!notification) {
      console.warn(`⚠️ [NotificationRoute] Notification not found (ID: ${id})`);
      return res.status(404).json({ message: "Notification not found" });
    }

    console.log(
      `📬 [NotificationRoute] Notification ${id} marked as ${
        notification.isRead ? "read" : "unread"
      }`
    );
    res.json(notification);
  } catch (err) {
    console.error(
      `❌ [NotificationRoute] Error updating notification ${req.params.id}:`,
      err.message
    );
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   DELETE /delete-read
 * @desc    Delete all read notifications for the user
 * @access  Private
 */
router.delete("/delete-read", verifyToken, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user.id,
      isRead: true,
    });

    console.log(
      `🗑️ [NotificationRoute] Deleted ${result.deletedCount} read notifications for user ${req.user.id}`
    );
    res.json({ message: `Deleted ${result.deletedCount} read notifications` });
  } catch (err) {
    console.error(
      "❌ [NotificationRoute] Error deleting read notifications:",
      err.message
    );
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
