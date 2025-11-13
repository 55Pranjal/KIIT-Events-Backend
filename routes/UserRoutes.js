import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// =============================
// 🔐 Register User
// =============================
router.post("/add", async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    console.info("[POST] /api/users/add - Registering new user");

    const { name, email, password, phone } = req.body;
    console.debug("[DEBUG] Received user data:", { name, email, phone });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(`[WARN] Registration attempt with existing email: ${email}`);
      return res
        .status(400)
        .json({ error: "This email already exists in our database" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role: "student",
      societyRequestStatus: "none",
    });

    await newUser.save();
    console.info(`[INFO] New user registered: ${email}`);

    const token = jwt.sign(
      {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        societyRequestStatus: newUser.societyRequestStatus,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      role: newUser.role,
      societyRequestStatus: newUser.societyRequestStatus,
    });
  } catch (err) {
    console.error("[ERROR] Failed to register user:", err.message);
    res.status(500).json({ error: "Server error while registering user" });
  }
});

// =============================
// 🔓 Login User
// =============================
router.post("/login", async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    console.info("[POST] /api/users/login - Login attempt");

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      console.warn(`[WARN] Login failed - user not found: ${email}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`[WARN] Login failed - invalid password for: ${email}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        societyRequestStatus: user.societyRequestStatus,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.info(`[INFO] Login successful for: ${email}`);

    res.status(200).json({
      message: "Login successful",
      token,
      role: user.role,
      societyRequestStatus: user.societyRequestStatus,
    });
  } catch (err) {
    console.error("[ERROR] Login failed:", err.message);
    res.status(500).json({ error: "Server error while logging in" });
  }
});

// =============================
// 👤 Get Current User Info
// =============================
router.get("/me", async (req, res) => {
  try {
    console.info("[GET] /api/users/me - Fetching current user details");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn("[WARN] No token provided in /me route");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id, { password: 0 });
    if (!user) {
      console.warn(`[WARN] User not found for ID: ${decoded.id}`);
      return res.status(404).json({ error: "User not found" });
    }

    console.info(`[INFO] User details fetched for: ${user.email}`);
    res.status(200).json(user);
  } catch (err) {
    console.error("[ERROR] Failed to fetch user:", err.message);
    res.status(500).json({ error: "Server error while fetching user" });
  }
});

// =============================
// ✏️ Update User Info
// =============================
router.put("/update", verifyToken, async (req, res) => {
  try {
    console.info(`[PUT] /api/users/update - Updating user ${req.user.id}`);

    const { name, phone } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone },
      { new: true }
    ).select("-password");

    console.info(`[INFO] User updated successfully: ${updatedUser.email}`);
    res.json(updatedUser);
  } catch (error) {
    console.error("[ERROR] Failed to update user:", error.message);
    res.status(500).json({ error: "Server error while updating user" });
  }
});

export default router;
