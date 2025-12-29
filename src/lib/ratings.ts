import type { RatingStats } from "./types";

export async function upsertRating(
  db: D1Database,
  themeId: string,
  keyId: string,
  rating: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ratings (theme_id, key_id, rating, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(theme_id, key_id) DO UPDATE SET
         rating = excluded.rating,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(themeId, keyId.toLowerCase(), rating)
    .run();
}

export async function hasRating(
  db: D1Database,
  themeId: string,
  keyId: string
): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM ratings WHERE theme_id = ? AND key_id = ?")
    .bind(themeId, keyId.toLowerCase())
    .first();
  return result !== null;
}

export async function getRatingStats(
  db: D1Database,
  themeId: string
): Promise<RatingStats> {
  const stats = await db
    .prepare(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
       FROM ratings WHERE theme_id = ?`
    )
    .bind(themeId)
    .first<{ avg_rating: number | null; rating_count: number }>();

  return {
    average: stats?.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : 0,
    count: stats?.rating_count || 0
  };
}

export async function getUserRatings(
  db: D1Database,
  keyId: string
): Promise<Record<string, number>> {
  const results = await db
    .prepare("SELECT theme_id, rating FROM ratings WHERE key_id = ?")
    .bind(keyId.toLowerCase())
    .all<{ theme_id: string; rating: number }>();

  const ratings: Record<string, number> = {};
  for (const row of results.results) {
    ratings[row.theme_id] = row.rating;
  }
  return ratings;
}
