import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import verifyToken from "../middleware/auth.js";
import {
  strictAuthLimiter,
  oauthLimiter,
  mutationLimiter,
} from "../middleware/rateLimiters.js";
import Society from "../models/Society.js";
import { validate } from "../middleware/validate.js";
import { updateUserSchema } from "../schemas/index.js";

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "kiit.ac.in";
const ADMIN_EMAIL_WHITELIST = (process.env.ADMIN_EMAIL_WHITELIST || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (!GOOGLE_CLIENT_ID) {
  console.warn(
    "[WARN] GOOGLE_CLIENT_ID is not set. /api/users/google will reject all requests."
  );
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const signSessionToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      societyRequestStatus: user.societyRequestStatus,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// =============================
// 🔐 Google OAuth Sign-in / Sign-up
// =============================
router.post("/google", oauthLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Missing Google credential" });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res
        .status(500)
        .json({ error: "Google sign-in is not configured on the server" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = (payload?.email || "").toLowerCase();
    const emailVerified = payload?.email_verified;
    const name = payload?.name || email.split("@")[0];
    const googleId = payload?.sub;

    if (!email || !emailVerified) {
      return res.status(401).json({ error: "Google email not verified" });
    }

    const isWhitelisted = ADMIN_EMAIL_WHITELIST.includes(email);
    const isKiitEmail = email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
    if (!isKiitEmail && !isWhitelisted) {
      console.warn(`[WARN] Google sign-in rejected for non-KIIT email: ${email}`);
      return res.status(403).json({
        error: `Only @${ALLOWED_EMAIL_DOMAIN} accounts are allowed. Please sign in with your KIIT email.`,
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        role: isWhitelisted ? "admin" : "student",
        societyRequestStatus: "none",
      });
      console.info(`[INFO] New user via Google: ${email} (role=${user.role})`);
    } else if (!user.googleId) {
      // Existing password user signing in with Google for the first time — link the account.
      user.googleId = googleId;
      await user.save();
      console.info(`[INFO] Linked Google account to existing user: ${email}`);
    }

    const token = signSessionToken(user);
    return res.status(200).json({
      message: "Signed in with Google",
      token,
      role: user.role,
      societyRequestStatus: user.societyRequestStatus,
      name: user.name,
    });
  } catch (err) {
    console.error("[ERROR] Google sign-in failed:", err.message);
    return res.status(401).json({ error: "Google sign-in failed" });
  }
});

// =============================
// 🔓 Legacy Password Login (kept for pre-OAuth users)
// =============================
router.post("/login", strictAuthLimiter, async (req, res) => {
  try {
    console.info("[POST] /api/users/login - Login attempt");

    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });

    if (!user || !user.password) {
      console.warn(`[WARN] Login failed - user not found or no password: ${email}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`[WARN] Login failed - invalid password for: ${email}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = signSessionToken(user);
    console.info(`[INFO] Login successful for: ${email}`);

    res.status(200).json({
      message: "Login successful",
      token,
      role: user.role,
      societyRequestStatus: user.societyRequestStatus,
      name: user.name,
    });
  } catch (err) {
    console.error("[ERROR] Login failed:", err.message);
    res.status(500).json({ error: "Server error while logging in" });
  }
});

// =============================
// 👤 Get Current User Info
// =============================
router.get("/me", verifyToken, async (req, res) => {
  try {
    console.info(
      "[GET] /api/users/me - Fetching current user details for",
      req.user.id
    );
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      console.warn(`[WARN] User not found for ID: ${req.user.id}`);
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("[ERROR] Failed to fetch user:", err.message);
    res.status(500).json({ error: "Server error while fetching user" });
  }
});

// =============================
// ✏️ Update User Info
// =============================
router.put(
  "/update",
  mutationLimiter,
  verifyToken,
  validate(updateUserSchema),
  async (req, res) => {
  try {
    console.info(`[PUT] /api/users/update - Updating user ${req.user.id}`);

    const { name } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true }
    ).select("-password");

    console.info(`[INFO] User updated successfully: ${updatedUser.email}`);
    res.json(updatedUser);
  } catch (error) {
    console.error("[ERROR] Failed to update user:", error.message);
    res.status(500).json({ error: "Server error while updating user" });
  }
});

/**
 * GET /api/society-accounts
 * Returns list of societies from Society collection
 * Only societies with requestStatus === "approved"
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const societies = await Society.find(
      { requestStatus: "approved" },
      { name: 1 }
    )
      .sort({ name: 1 })
      .lean();

    return res.json(societies);
  } catch (err) {
    console.error("[SocietyAccounts] Error fetching societies:", err);
    return res.status(500).json({ message: "Failed to fetch societies" });
  }
});

/**
 * Public list of societies (approved only)
 * GET /api/society-accounts/public
 */
router.get("/public", async (req, res) => {
  try {
    const societies = await Society.find(
      { requestStatus: "approved" },
      { name: 1 }
    )
      .sort({ name: 1 })
      .lean();

    return res.json(societies);
  } catch (err) {
    console.error("[SocietyAccounts.public] Error fetching societies:", err);
    return res.status(500).json({ message: "Failed to fetch societies" });
  }
});

export default router;
