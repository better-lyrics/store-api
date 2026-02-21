import { Hono } from "hono";
import type { Env, StatsResponse, RatingAggregateRow } from "../lib/types";
import { getAllInstallCounts } from "../lib/installs";

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

  const installCounts = await getAllInstallCounts(c.env.DB);

  const result: StatsResponse = {};

  for (const { theme_id, count } of installCounts) {
    const rating = ratingsMap.get(theme_id);
    result[theme_id] = {
      installs: count,
      rating: rating?.average || 0,
      ratingCount: rating?.count || 0,
    };
    ratingsMap.delete(theme_id);
  }

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
