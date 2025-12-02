import express from "express";
import Society from "../models/Society.js";
import User from "../models/User.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// Middleware: require admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - admin only" });
  }
  next();
};

/**
 * GET /api/admin/societies
 * Returns all societies (admin only). Populates president (name, email, phone).
 */
router.get("/societies", verifyToken, requireAdmin, async (req, res) => {
  try {
    const societies = await Society.find({})
      .populate({ path: "president", select: "name email phone" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(societies);
  } catch (err) {
    console.error("[AdminSocieties] Error fetching societies:", err);
    return res.status(500).json({ message: "Failed to fetch societies" });
  }
});

/**
 * DELETE /api/admin/societies
 * Body: { ids: ["id1","id2", ...] }
 * Deletes multiple societies (admin only)
 */
router.delete("/societies", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No society ids provided" });
    }

    // OPTIONAL SAFETY: prevent accidental deletion of special societies
    // e.g., if you have root society ids that must not be deleted
    // const protectedIds = ["..."];
    // if (ids.some(id => protectedIds.includes(id))) return res.status(403).json({message:"Cannot delete protected societies"});

    const result = await Society.deleteMany({ _id: { $in: ids } });

    // result.deletedCount gives number deleted
    return res.json({
      message: "Societies deleted",
      deletedCount: result.deletedCount,
      ids,
    });
  } catch (err) {
    console.error("[AdminSocieties] bulk delete error:", err);
    return res.status(500).json({ message: "Failed to delete societies" });
  }
});

/**
 * DELETE /api/admin/societies/:id
 * Deletes a single society
 */
router.delete("/societies/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Society.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Society not found" });
    }
    return res.json({ message: "Society deleted", id });
  } catch (err) {
    console.error("[AdminSocieties] delete error:", err);
    return res.status(500).json({ message: "Failed to delete society" });
  }
});

export default router;
