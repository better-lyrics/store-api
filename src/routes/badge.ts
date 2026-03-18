import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getInstallCount } from "../lib/installs";

const badge = new Hono<{ Bindings: Env }>();

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

badge.get("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");
  const installCount = await getInstallCount(c.env.DB, themeId);

  return c.json({
    schemaVersion: 1,
    label: "Better Lyrics Themes",
    message: `${formatCount(installCount)} installs`,
    color: "F50032",
  });
});

export default badge;
