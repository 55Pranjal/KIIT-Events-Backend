import express from "express";
import Society from "../models/Society.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import verifyToken from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { societyDecisionSchema } from "../schemas/index.js";
// import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// Admin gate: relies on shared verifyToken (which sets req.user from the JWT)
// and only adds the role check on top.
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    console.warn(
      `[WARN] Unauthorized admin access attempt by user ID: ${req.user?.id}`
    );
    return res.status(403).json({ error: "Access denied" });
  }
  next();
};

const verifyAdmin = [verifyToken, requireAdmin];

// ✅ GET: Fetch all pending society requests
router.get("/society-requests", verifyAdmin, async (req, res) => {
  try {
    console.log(
      "[GET] /api/admin/society-requests — Fetching pending requests"
    );
    const requests = await Society.find({ requestStatus: "pending" }).populate(
      "president",
      "name email"
    );

    console.log(`[INFO] Found ${requests.length} pending society requests`);
    res.status(200).json(requests);
  } catch (err) {
    console.error("[ERROR] Failed to fetch society requests:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ POST: Approve or reject a society request
router.post(
  "/society-requests/:id/decision",
  verifyAdmin,
  validate(societyDecisionSchema),
  async (req, res) => {
  try {
    const { decision } = req.body;
    console.log(
      `[POST] /api/admin/society-requests/${req.params.id}/decision — Decision: ${decision}`
    );

    const society = await Society.findById(req.params.id).populate("president");
    if (!society) {
      console.warn(`[WARN] Society not found for ID: ${req.params.id}`);
      return res.status(404).json({ error: "Society not found" });
    }

    const president = society.president;
    if (!president) {
      console.warn(
        `[WARN] Society ${society._id} has no president user — cannot apply decision`
      );
      return res
        .status(500)
        .json({ error: "Society is missing a linked president user" });
    }

    // Snapshot the prior values so we can revert if the second write fails.
    // MongoDB transactions would be cleaner but require a replica set; this
    // manual revert keeps both documents consistent on standalone deployments.
    const prevSocietyStatus = society.requestStatus;
    const prevUserRole = president.role;
    const prevUserStatus = president.societyRequestStatus;

    society.requestStatus = decision;
    await society.save();

    try {
      if (decision === "approved") {
        president.role = "society";
        president.societyRequestStatus = "approved";
      } else {
        president.societyRequestStatus = "rejected";
      }
      await president.save();
    } catch (userSaveErr) {
      console.error(
        "[ERROR] Failed to update president after society save — reverting society:",
        userSaveErr.message
      );
      society.requestStatus = prevSocietyStatus;
      try {
        await society.save();
      } catch (revertErr) {
        console.error(
          "[FATAL] Society revert failed — manual reconciliation needed:",
          revertErr.message,
          { societyId: society._id, decision, prevSocietyStatus }
        );
      }
      return res.status(500).json({ error: "Failed to apply decision" });
    }

    const message =
      decision === "approved"
        ? `Your society request for "${society.name}" has been approved.`
        : `Your society request for "${society.name}" has been rejected.`;

    // Notification is best-effort; the role change is what matters for the user.
    let notification = null;
    try {
      notification = await Notification.create({
        userId: president._id,
        message,
        isRead: false,
      });
    } catch (notifyErr) {
      console.error(
        "[WARN] Failed to create notification for society decision:",
        notifyErr.message
      );
    }

    console.log(`[INFO] Society request ${decision} for: ${society.name}`);

    // --- Optional email sending (commented for production readiness) ---
    // const subject =
    //   decision === "approved"
    //     ? "Your Society Request Has Been Approved"
    //     : "Your Society Request Has Been Rejected";
    //
    // const html = `
    //   <div style="font-family: Arial, sans-serif; color: #333;">
    //     <h2>${decision === "approved" ? "Congratulations!" : "We're Sorry"}</h2>
    //     <p>Dear ${president.name},</p>
    //     <p>Your society request for <strong>${society.name}</strong> has been <strong>${decision}</strong>.</p>
    //     ${decision === "approved"
    //       ? `<p>You now have access to the Society Dashboard to manage your events.</p>`
    //       : `<p>You can reapply later with an improved proposal.</p>`}
    //     <br/>
    //     <p>Best Regards,<br/>CollegeVents Admin</p>
    //   </div>
    // `;
    //
    // await sendEmail(president.email, subject, html);

    res.status(200).json({
      message: `Society request ${decision} successfully.`,
      notification,
    });
  } catch (err) {
    console.error("[ERROR] Admin decision error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ POST: Revoke an approved society — admin downgrades the president back
// to a regular student account. Existing events stay (admin can delete them
// individually); the (former) president loses the ability to create new ones.
router.post("/societies/:id/revoke", verifyAdmin, async (req, res) => {
  try {
    const society = await Society.findById(req.params.id).populate("president");
    if (!society) {
      return res.status(404).json({ error: "Society not found" });
    }
    if (society.requestStatus !== "approved") {
      return res
        .status(400)
        .json({ error: "Only approved societies can be revoked" });
    }

    const president = society.president;
    if (!president) {
      return res
        .status(500)
        .json({ error: "Society is missing a linked president user" });
    }

    const prevSocietyStatus = society.requestStatus;
    const prevUserRole = president.role;
    const prevUserStatus = president.societyRequestStatus;

    society.requestStatus = "rejected";
    await society.save();

    try {
      president.role = "student";
      president.societyRequestStatus = "rejected";
      await president.save();
    } catch (userSaveErr) {
      console.error(
        "[ERROR] Failed to downgrade president — reverting society:",
        userSaveErr.message
      );
      society.requestStatus = prevSocietyStatus;
      try {
        await society.save();
      } catch (revertErr) {
        console.error(
          "[FATAL] Society revert failed during revoke — manual reconciliation needed:",
          revertErr.message,
          { societyId: society._id }
        );
      }
      return res.status(500).json({ error: "Failed to revoke society" });
    }

    try {
      await Notification.create({
        userId: president._id,
        message: `Your society "${society.name}" access has been revoked by an admin.`,
        isRead: false,
      });
    } catch (notifyErr) {
      console.error(
        "[WARN] Failed to create revoke notification:",
        notifyErr.message
      );
    }

    console.log(
      `[INFO] Society "${society.name}" revoked by admin ${req.user.id} (was role=${prevUserRole}, status=${prevUserStatus})`
    );
    res.status(200).json({ message: "Society revoked successfully." });
  } catch (err) {
    console.error("[ERROR] Society revoke failed:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
