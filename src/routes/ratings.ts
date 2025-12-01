import { Hono } from "hono";
import type { Env, RatingResponse, RatingBody, ErrorResponse } from "../lib/types";
import { isValidThemeId, validateRatingBody } from "../lib/validation";

const ratings = new Hono<{ Bindings: Env }>();

// Rate limit: max ratings per IP per theme per day
const RATE_LIMIT_TTL = 60 * 60 * 24;

// POST /api/rate/:themeId - Submit or update a rating
ratings.post("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");

  // Get client IP for rate limiting (only trust CF-Connecting-IP)
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `ratelimit:rate:${ip}:${themeId}`;

  // Check rate limit - one rating per IP per theme per day
  const existingRateLimit = await c.env.KV.get(rateLimitKey);
  if (existingRateLimit) {
    return c.json<ErrorResponse>(
      {
        error: "RATE_LIMITED",
        message: "Rating already submitted for this theme today",
      },
      429
    );
  }

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

  // Parse and validate body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>(
      {
        error: "INVALID_JSON",
        message: "Request body must be valid JSON",
      },
      400
    );
  }

  const validationError = validateRatingBody(body);
  if (validationError) {
    return c.json<ErrorResponse>(
      {
        error: "VALIDATION_ERROR",
        message: validationError.message,
      },
      400
    );
  }

  const { rating, odid } = body as RatingBody;

  // Upsert the rating and set rate limit marker
  await Promise.all([
    c.env.DB.prepare(
      `INSERT INTO ratings (theme_id, odid, rating, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(theme_id, odid) DO UPDATE SET
         rating = excluded.rating,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(themeId, odid, rating)
      .run(),
    c.env.KV.put(rateLimitKey, "1", { expirationTtl: RATE_LIMIT_TTL }),
  ]);

  // Get updated stats
  const stats = await c.env.DB.prepare(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM ratings WHERE theme_id = ?`
  )
    .bind(themeId)
    .first<{ avg_rating: number; rating_count: number }>();

  return c.json<RatingResponse>({
    average: stats ? Math.round(stats.avg_rating * 10) / 10 : 0,
    count: stats?.rating_count || 0,
  });
});

// GET /api/rating/:themeId - Get rating stats for a theme
ratings.get("/:themeId", async (c) => {
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

  const stats = await c.env.DB.prepare(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM ratings WHERE theme_id = ?`
  )
    .bind(themeId)
    .first<{ avg_rating: number | null; rating_count: number }>();

  return c.json<RatingResponse>({
    average: stats?.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : 0,
    count: stats?.rating_count || 0,
  });
});

export default ratings;
