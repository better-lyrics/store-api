import { Hono } from "hono";
import type { Env, ErrorResponse } from "../lib/types";
import { getLockfile, resolveBuild } from "../lib/resolve";

const resolve = new Hono<{ Bindings: Env }>();

// Accepts 3-part (ext) or longer dotted numeric versions, e.g. "2.3.2".
const VERSION_PATTERN = /^\d+(\.\d+){1,3}$/;

// GET /api/resolve/:themeId?ext=<version>
// Returns the winning build of a theme for the given extension version.
resolve.get("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");
  const ext = c.req.query("ext");

  if (!ext || !VERSION_PATTERN.test(ext)) {
    return c.json<ErrorResponse>(
      { error: "BAD_REQUEST", message: "Missing or malformed ext version" },
      400
    );
  }

  const lockfile = await getLockfile(c.env);
  const entry = lockfile.themes.find((t) => t.id === themeId);

  if (!entry) {
    return c.json<ErrorResponse>({ error: "THEME_NOT_FOUND", message: "Theme not found" }, 404);
  }

  const build = resolveBuild(entry, ext);

  if (!build) {
    return c.json<ErrorResponse>(
      { error: "NO_COMPATIBLE_BUILD", message: "No build compatible with this extension version" },
      404
    );
  }

  return c.json({
    id: themeId,
    version: build.version,
    minVersion: build.minVersion,
    path: build.path,
    integrity: build.integrity,
  });
});

export default resolve;
