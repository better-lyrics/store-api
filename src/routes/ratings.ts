import { Hono } from "hono";
import type { Env, RatingResponse, RatingBody, ErrorResponse } from "../lib/types";
import { isValidThemeId, validateRatingBody } from "../lib/validation";

const ratings = new Hono<{ Bindings: Env }>();

const RATE_LIMIT_TTL = 60 * 60;
const RATE_LIMIT_MAX = 10;

// POST /api/rate/:themeId - Submit or update a rating
ratings.post("/:themeId", async (c) => {
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

  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `ratelimit:rate:${ip}`;

  const existingRating = await c.env.DB.prepare(
    `SELECT 1 FROM ratings WHERE theme_id = ? AND odid = ?`
  )
    .bind(themeId, odid)
    .first();

  if (!existingRating) {
    const currentCount = parseInt((await c.env.KV.get(rateLimitKey)) || "0", 10);
    if (currentCount >= RATE_LIMIT_MAX) {
      return c.json<ErrorResponse>(
        {
          error: "RATE_LIMITED",
          message: "Too many new ratings, please try again later",
        },
        429
      );
    }
    await c.env.KV.put(rateLimitKey, (currentCount + 1).toString(), {
      expirationTtl: RATE_LIMIT_TTL,
    });
  }

  await c.env.DB.prepare(
    `INSERT INTO ratings (theme_id, odid, rating, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(theme_id, odid) DO UPDATE SET
       rating = excluded.rating,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(themeId, odid, rating)
    .run();

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
