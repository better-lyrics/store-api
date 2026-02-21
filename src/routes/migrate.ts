import { Hono } from "hono";
import type { Env, ErrorResponse } from "../lib/types";

const migrate = new Hono<{ Bindings: Env }>();

const D1_BATCH_SIZE = 80;

migrate.post("/migrate", async (c) => {
  const installCountsInserted = await migrateInstallCounts(c.env.KV, c.env.DB);
  const installMarkersInserted = await migrateInstallMarkers(c.env.KV, c.env.DB);

  return c.json({
    installCounts: installCountsInserted,
    installMarkers: installMarkersInserted,
  });
});

async function migrateInstallCounts(
  kv: KVNamespace,
  db: D1Database
): Promise<number> {
  let cursor: string | undefined;
  let totalInserted = 0;

  do {
    const listResult = await kv.list({
      prefix: "installs:",
      cursor,
    });

    const statements: D1PreparedStatement[] = [];
    for (const key of listResult.keys) {
      const themeId = key.name.replace("installs:", "");
      const countValue = await kv.get(key.name);
      const count = parseInt(countValue || "0", 10) || 0;

      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO install_counts (theme_id, count) VALUES (?, ?)`
          )
          .bind(themeId, count)
      );
    }

    for (let i = 0; i < statements.length; i += D1_BATCH_SIZE) {
      const chunk = statements.slice(i, i + D1_BATCH_SIZE);
      await db.batch(chunk);
    }

    totalInserted += statements.length;
    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);

  return totalInserted;
}

async function migrateInstallMarkers(
  kv: KVNamespace,
  db: D1Database
): Promise<number> {
  let cursor: string | undefined;
  let totalInserted = 0;

  do {
    const listResult = await kv.list({
      prefix: "installed:",
      cursor,
    });

    const statements: D1PreparedStatement[] = [];
    for (const key of listResult.keys) {
      const withoutPrefix = key.name.replace("installed:", "");
      const separatorIndex = withoutPrefix.indexOf(":");
      if (separatorIndex === -1) continue;

      const keyId = withoutPrefix.substring(0, separatorIndex);
      const themeId = withoutPrefix.substring(separatorIndex + 1);

      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO install_markers (key_id, theme_id) VALUES (?, ?)`
          )
          .bind(keyId, themeId)
      );
    }

    for (let i = 0; i < statements.length; i += D1_BATCH_SIZE) {
      const chunk = statements.slice(i, i + D1_BATCH_SIZE);
      await db.batch(chunk);
    }

    totalInserted += statements.length;
    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);

  return totalInserted;
}

export default migrate;
