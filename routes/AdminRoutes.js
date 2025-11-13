import express from "express";
import Society from "../models/Society.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
// import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// ✅ Middleware: Verify admin using token
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn("[WARN] Missing authorization header");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || user.role !== "admin") {
      console.warn(
        `[WARN] Unauthorized access attempt by user ID: ${decoded.id}`
      );
      return res.status(403).json({ error: "Access denied" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("[ERROR] Token verification failed:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

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
router.post("/society-requests/:id/decision", verifyAdmin, async (req, res) => {
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

    society.requestStatus = decision;
    await society.save();

    const president = society.president;
    if (decision === "approved") {
      president.role = "society";
      president.societyRequestStatus = "approved";
    } else {
      president.societyRequestStatus = "rejected";
    }
    await president.save();

    const message =
      decision === "approved"
        ? `Your society request for "${society.name}" has been approved.`
        : `Your society request for "${society.name}" has been rejected.`;

    const notification = new Notification({
      userId: president._id,
      message,
      isRead: false,
    });
    await notification.save();

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

export default router;
