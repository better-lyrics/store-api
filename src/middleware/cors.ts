import { cors } from "hono/cors";

const BROWSER_EXTENSION_PROTOCOLS = [
  "chrome-extension://",
  "moz-extension://",
];

export const corsMiddleware = cors({
  origin: (origin) => {
    if (
      origin &&
      BROWSER_EXTENSION_PROTOCOLS.some((protocol) =>
        origin.startsWith(protocol)
      )
    ) {
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
