import express from "express";
import Query from "../models/queryModel.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /
 * @desc    Submit a new query
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const { id: userId, name, email } = req.user;

    if (!message?.trim()) {
      console.warn("⚠️ [QueryRoute] Empty message received from user:", userId);
      return res
        .status(400)
        .json({ success: false, message: "Message cannot be empty" });
    }

    const query = new Query({
      name,
      email,
      message,
      user: userId,
    });

    await query.save();
    console.log(
      `✅ [QueryRoute] Query saved successfully (ID: ${query._id}) by user ${userId}`
    );

    res.status(201).json({ success: true, message: "Query received!" });
  } catch (err) {
    console.error("❌ [QueryRoute] Error saving query:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * @route   GET /my
 * @desc    Get all queries for the logged-in user
 * @access  Private
 */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { id: userId } = req.user;
    const myQueries = await Query.find({ user: userId }).sort({
      createdAt: -1,
    });

    console.log(
      `📦 [QueryRoute] Found ${myQueries.length} queries for user ${userId}`
    );
    res.json(myQueries);
  } catch (err) {
    console.error("❌ [QueryRoute] Error fetching user queries:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /
 * @desc    Get all queries (Admin only)
 * @access  Private (Admin)
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      console.warn(
        `🚫 [QueryRoute] Unauthorized access attempt by user ${req.user.id}`
      );
      return res.status(403).json({ message: "Access denied" });
    }

    const allQueries = await Query.find().sort({ createdAt: -1 });
    console.log(
      `📋 [QueryRoute] Admin fetched ${allQueries.length} total queries`
    );
    res.json(allQueries);
  } catch (err) {
    console.error("❌ [QueryRoute] Error fetching all queries:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PUT /:id
 * @desc    Add or update a reply to a query
 * @access  Private (Admin)
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const queryId = req.params.id;
    const { reply } = req.body;

    if (role !== "admin") {
      console.warn(
        `🚫 [QueryRoute] Non-admin (${userId}) tried to update query ${queryId}`
      );
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const query = await Query.findById(queryId);
    if (!query) {
      console.warn(`⚠️ [QueryRoute] Query not found (ID: ${queryId})`);
      return res.status(404).json({ message: "Query not found" });
    }

    query.reply = reply;
    await query.save();

    console.log(
      `💬 [QueryRoute] Reply updated for query ${queryId} by admin ${userId}`
    );
    res.json({ success: true });
  } catch (err) {
    console.error(
      `❌ [QueryRoute] Error replying to query ${req.params.id}:`,
      err.message
    );
    res.status(500).json({ success: false, message: "Failed to reply" });
  }
});

export default router;
