export async function hasInstallMarker(
  db: D1Database,
  keyId: string,
  themeId: string
): Promise<boolean> {
  const result = await db
    .prepare("SELECT 1 FROM install_markers WHERE key_id = ? AND theme_id = ?")
    .bind(keyId, themeId)
    .first();
  return result !== null;
}

export async function recordInstall(
  db: D1Database,
  keyId: string,
  themeId: string
): Promise<number> {
  const insertMarker = db
    .prepare("INSERT INTO install_markers (key_id, theme_id) VALUES (?, ?)")
    .bind(keyId, themeId);

  const upsertCount = db
    .prepare(
      `INSERT INTO install_counts (theme_id, count) VALUES (?, 1)
       ON CONFLICT(theme_id) DO UPDATE SET count = count + 1`
    )
    .bind(themeId);

  const selectCount = db
    .prepare("SELECT count FROM install_counts WHERE theme_id = ?")
    .bind(themeId);

  const results = await db.batch([insertMarker, upsertCount, selectCount]);
  const countRow = results[2].results?.[0] as { count: number } | undefined;
  return countRow?.count ?? 1;
}

export async function getInstallCount(
  db: D1Database,
  themeId: string
): Promise<number> {
  const result = await db
    .prepare("SELECT count FROM install_counts WHERE theme_id = ?")
    .bind(themeId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function getAllInstallCounts(
  db: D1Database
): Promise<Array<{ theme_id: string; count: number }>> {
  const result = await db
    .prepare("SELECT theme_id, count FROM install_counts")
    .all<{ theme_id: string; count: number }>();
  return result.results;
}
