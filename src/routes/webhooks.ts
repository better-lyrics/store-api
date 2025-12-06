import { Hono } from "hono";
import type { Env, ErrorResponse, ThemeMetadata, WebhookPayload } from "../lib/types";
import {
  verifyWebhookSignature,
  setCommitStatus,
  triggerRegistryDispatch,
} from "../lib/github";

const webhooks = new Hono<{ Bindings: Env }>();

async function fetchMetadata(
  repo: string,
  commit: string
): Promise<ThemeMetadata> {
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/metadata.json`;

  const response = await fetch(url, {
    headers: { "User-Agent": "better-lyrics-store-api" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch metadata.json");
  }

  const metadata = (await response.json()) as Record<string, unknown>;

  if (!metadata.id || typeof metadata.id !== "string") {
    throw new Error("Missing or invalid id in metadata.json");
  }
  if (!metadata.version || typeof metadata.version !== "string") {
    throw new Error("Missing or invalid version in metadata.json");
  }
  if (!metadata.title || typeof metadata.title !== "string") {
    throw new Error("Missing or invalid title in metadata.json");
  }
  if (!Array.isArray(metadata.creators) || metadata.creators.length === 0) {
    throw new Error("Missing or invalid creators in metadata.json");
  }

  if (!/^[a-z0-9-]+$/.test(metadata.id)) {
    throw new Error("Invalid id format: must be lowercase letters, numbers, and hyphens");
  }

  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(metadata.version)) {
    throw new Error("Invalid version format: must be semver (e.g., 1.0.0)");
  }

  return metadata as unknown as ThemeMetadata;
}

async function checkThemeRegistered(repo: string): Promise<boolean> {
  const indexUrl =
    "https://raw.githubusercontent.com/better-lyrics/themes/master/index.json";

  const response = await fetch(indexUrl, {
    headers: { "User-Agent": "better-lyrics-store-api" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch theme registry");
  }

  const index = (await response.json()) as { themes?: Array<{ repo: string }> };
  return index.themes?.some((t) => t.repo === repo) ?? false;
}

async function logWebhook(
  db: D1Database,
  data: {
    deliveryId?: string;
    repo?: string;
    commit?: string;
    event?: string;
    status: string;
    error?: string;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO webhook_logs (delivery_id, repo, commit_sha, event, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (delivery_id) DO UPDATE SET status = excluded.status, error = excluded.error`
      )
      .bind(
        data.deliveryId ?? null,
        data.repo ?? null,
        data.commit ?? null,
        data.event ?? null,
        data.status,
        data.error ?? null,
        Date.now()
      )
      .run();
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

webhooks.post("/github", async (c) => {
  const signature = c.req.header("x-hub-signature-256") || "";
  const event = c.req.header("x-github-event");
  const deliveryId = c.req.header("x-github-delivery");
  const body = await c.req.text();

  const isValid = await verifyWebhookSignature(
    c.env.GITHUB_WEBHOOK_SECRET,
    body,
    signature
  );

  if (!isValid) {
    console.error("Invalid webhook signature", { deliveryId });
    return c.json<ErrorResponse>(
      { error: "INVALID_SIGNATURE", message: "Invalid signature" },
      401
    );
  }

  if (event !== "push") {
    return c.json({ message: "Ignored", event }, 200);
  }

  const payload = JSON.parse(body) as WebhookPayload;
  const repo = payload.repository.full_name;
  const commit = payload.after;
  const ref = payload.ref;
  const installationId = payload.installation?.id;

  // Only process main/master branch
  if (ref !== "refs/heads/main" && ref !== "refs/heads/master") {
    return c.json({ message: "Ignoring non-default branch", ref }, 200);
  }

  if (repo === "better-lyrics/themes") {
    return c.json({ message: "Ignoring registry repo" }, 200);
  }

  if (!installationId) {
    return c.json<ErrorResponse>(
      { error: "MISSING_INSTALLATION", message: "No installation ID in payload" },
      400
    );
  }

  const metadataChanged = payload.commits?.some(
    (c) => c.modified?.includes("metadata.json") || c.added?.includes("metadata.json")
  );

  if (!metadataChanged) {
    return c.json({ message: "No metadata.json changes", repo }, 200);
  }

  await logWebhook(c.env.DB, {
    deliveryId,
    repo,
    commit,
    event: "push",
    status: "processing",
  });

  try {
    const metadata = await fetchMetadata(repo, commit);

    const isRegistered = await checkThemeRegistered(repo);

    if (!isRegistered) {
      await logWebhook(c.env.DB, { deliveryId, status: "skipped" });
      return c.json({ message: "Theme not registered", repo }, 200);
    }

    await setCommitStatus(c.env, installationId, {
      repo,
      commit,
      state: "pending",
      description: "Publishing to registry...",
      context: "Better Lyrics Registry",
    });

    await triggerRegistryDispatch(c.env, { repo, commit, installationId });

    await logWebhook(c.env.DB, { deliveryId, status: "dispatched" });

    return c.json({
      message: "Update triggered",
      repo,
      commit,
      version: metadata.version,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook processing failed", { repo, error: message });

    await setCommitStatus(c.env, installationId, {
      repo,
      commit,
      state: "failure",
      description: message.slice(0, 140),
      context: "Better Lyrics Registry",
    });

    await logWebhook(c.env.DB, {
      deliveryId,
      status: "failed",
      error: message,
    });

    return c.json<ErrorResponse>(
      { error: "PROCESSING_FAILED", message },
      500
    );
  }
});

webhooks.post("/marketplace", async (c) => {
  return c.text("OK", 200);
});

interface CompletePayload {
  repo: string;
  commit: string;
  installationId: number;
  success: boolean;
  description?: string;
}

webhooks.post("/complete", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== c.env.GITHUB_WEBHOOK_SECRET) {
    return c.json<ErrorResponse>(
      { error: "UNAUTHORIZED", message: "Invalid token" },
      401
    );
  }

  const body = (await c.req.json()) as CompletePayload;
  const { repo, commit, installationId, success, description } = body;

  if (!repo || !commit || !installationId) {
    return c.json<ErrorResponse>(
      { error: "BAD_REQUEST", message: "Missing repo, commit, or installationId" },
      400
    );
  }

  await setCommitStatus(c.env, installationId, {
    repo,
    commit,
    state: success ? "success" : "failure",
    description: description || (success ? "Published to registry" : "Failed to publish"),
    context: "Better Lyrics Registry",
  });

  return c.json({ message: "Status updated", repo, commit, success });
});

export default webhooks;
