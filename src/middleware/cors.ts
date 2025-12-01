import { cors } from "hono/cors";

// Allow requests from Chrome extensions
const CHROME_EXTENSION_PATTERN = /^chrome-extension:\/\/[a-z]{32}$/;

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow chrome-extension:// origins
    if (origin && CHROME_EXTENSION_PATTERN.test(origin)) {
      return origin;
    }
    // Allow requests with no origin (e.g., from server-side or curl)
    if (!origin) {
      return "*";
    }
    // Block other origins in production, but allow localhost for development
    if (origin.startsWith("http://localhost:")) {
      return origin;
    }
    return null;
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  maxAge: 86400, // 24 hours
});
