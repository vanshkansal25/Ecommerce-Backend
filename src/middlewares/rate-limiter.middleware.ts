import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/apiError";

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,
    handler: (req, res, next) => {
        throw new ApiError(429, "Too many requests. Please try again later.");
    }
});

export const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Only 5 checkout attempts per hour per IP
    message: {
        status: 429,
        message: "Too many checkout attempts. Please contact support if you are having issues."
    },
    standardHeaders: true,
    legacyHeaders: false,
});