import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

const jsonHandler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: options.message || "Too many requests, please slow down.",
  });
};

const baseConfig = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonHandler,
  // Skip in dev so iterating locally doesn't get throttled.
  skip: () => isDev,
};

/**
 * Defense-in-depth global cap across /api/*.
 * Catches scraping and broad abuse before hitting per-route limits.
 */
export const globalApiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: "Too many requests from this IP, please try again later.",
});

/**
 * Strict limiter for credential-based login. Brute-force protection.
 * Counts failed and successful attempts together (an attacker can't probe
 * for valid emails by watching only successful responses).
 */
export const strictAuthLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message:
    "Too many login attempts. Please wait 15 minutes before trying again.",
});

/**
 * Google OAuth sign-in. Looser than password login because Google itself
 * handles bot detection upstream, but we still cap to prevent abuse of
 * the token-verification cost on our side.
 */
export const oauthLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many sign-in attempts. Please try again shortly.",
});

/**
 * Generic write protection for authenticated mutations
 * (event RSVPs, society requests, profile updates, queries).
 */
export const mutationLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: "You're doing that too quickly. Please slow down.",
});

/**
 * Tight cap on Cloudinary uploads — these cost real money and bandwidth.
 */
export const uploadLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Upload limit reached. Please try again later.",
});
