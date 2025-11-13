import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

// ✅ Load environment variable securely
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[FATAL] Missing JWT_SECRET in environment variables.");
  throw new Error("JWT_SECRET is missing. Please add it to your .env file.");
}

/**
 * Middleware to verify JWT tokens in Authorization header.
 * @route Protected routes only
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn("[WARN] No Authorization header provided.");
    return res.status(401).json({ msg: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.warn("[WARN] Malformed Authorization header, missing token.");
    return res.status(401).json({ msg: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error(`[ERROR] JWT verification failed: ${err.message}`);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};

export default verifyToken;
