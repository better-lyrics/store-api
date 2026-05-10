export interface RateLimitCheck {
  allowed: boolean;
  count: number;
}

export async function checkLimit(
  db: D1Database,
  scope: string,
  key: string,
  max: number
): Promise<RateLimitCheck> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare("SELECT count, expires_at FROM rate_limits WHERE scope = ? AND key = ?")
    .bind(scope, key)
    .first<{ count: number; expires_at: number }>();

  if (!row || row.expires_at <= now) {
    return { allowed: true, count: 0 };
  }
  return { allowed: row.count < max, count: row.count };
}

export async function incrementLimit(
  db: D1Database,
  scope: string,
  key: string,
  ttlSeconds: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const newExpiresAt = now + ttlSeconds;
  await db
    .prepare(
      `INSERT INTO rate_limits (scope, key, count, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(scope, key) DO UPDATE SET
         count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
         expires_at = ?`
    )
    .bind(scope, key, newExpiresAt, now, newExpiresAt)
    .run();
}
