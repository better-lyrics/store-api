import { Hono } from "hono";
import type { Env, StatsResponse, RatingAggregateRow } from "../lib/types";

const stats = new Hono<{ Bindings: Env }>();

// GET /api/stats - Get all theme stats in one call
stats.get("/", async (c) => {
  // Get all ratings aggregated by theme
  const ratingsResult = await c.env.DB.prepare(
    `SELECT theme_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM ratings GROUP BY theme_id`
  ).all<RatingAggregateRow>();

  // Build a map of theme ratings
  const ratingsMap = new Map<string, { average: number; count: number }>();
  for (const row of ratingsResult.results || []) {
    ratingsMap.set(row.theme_id, {
      average: Math.round(row.avg_rating * 10) / 10,
      count: row.rating_count,
    });
  }

  // Get all install counts from KV
  // Note: KV list has a 1000 key limit per call, paginate if needed
  const installsList = await c.env.KV.list({ prefix: "installs:" });

  const result: StatsResponse = {};

  // Fetch all install counts in parallel
  const installPromises = installsList.keys.map(async (key) => {
    const themeId = key.name.replace("installs:", "");
    const count = await c.env.KV.get(key.name);
    return { themeId, count: parseInt(count || "0", 10) };
  });

  const installs = await Promise.all(installPromises);

  // Combine install counts with ratings
  for (const { themeId, count } of installs) {
    const rating = ratingsMap.get(themeId);
    result[themeId] = {
      installs: count,
      rating: rating?.average || 0,
      ratingCount: rating?.count || 0,
    };
    ratingsMap.delete(themeId); // Remove to track themes with only ratings
  }

  // Add themes that have ratings but no installs
  for (const [themeId, rating] of ratingsMap) {
    result[themeId] = {
      installs: 0,
      rating: rating.average,
      ratingCount: rating.count,
    };
  }

  return c.json(result);
});

export default stats;
