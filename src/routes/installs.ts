import { Hono } from "hono";
import type { Env, InstallResponse, ErrorResponse } from "../lib/types";
import { isValidThemeId } from "../lib/validation";

const installs = new Hono<{ Bindings: Env }>();

// Rate limit key TTL: 24 hours in seconds
const RATE_LIMIT_TTL = 60 * 60 * 24;

installs.post("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");

  // Validate theme ID
  if (!isValidThemeId(themeId)) {
    return c.json<ErrorResponse>(
      {
        error: "INVALID_THEME_ID",
        message: "Theme ID must be alphanumeric with hyphens only",
      },
      400
    );
  }

  // Get client IP for rate limiting
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const rateLimitKey = `ratelimit:install:${ip}:${themeId}`;

  // Check rate limit
  const existing = await c.env.KV.get(rateLimitKey);
  if (existing) {
    return c.json<ErrorResponse>(
      {
        error: "RATE_LIMITED",
        message: "Install already counted for this theme today",
      },
      429
    );
  }

  // Increment install count atomically using KV
  const installKey = `installs:${themeId}`;
  const currentCount = await c.env.KV.get(installKey);
  const newCount = (parseInt(currentCount || "0", 10) || 0) + 1;

  // Set the new count and rate limit marker
  await Promise.all([
    c.env.KV.put(installKey, newCount.toString()),
    c.env.KV.put(rateLimitKey, "1", { expirationTtl: RATE_LIMIT_TTL }),
  ]);

  return c.json<InstallResponse>({ count: newCount });
});

export default installs;
