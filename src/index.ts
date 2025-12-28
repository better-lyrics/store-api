import { Hono } from "hono";
import type { Env } from "./lib/types";
import { corsMiddleware } from "./middleware/cors";
import installs from "./routes/installs";
import ratings from "./routes/ratings";
import stats from "./routes/stats";
import webhooks from "./routes/webhooks";
import identity from "./routes/identity";

const app = new Hono<{ Bindings: Env }>();

// Apply CORS middleware globally
app.use("*", corsMiddleware);

// Mount routes
app.route("/api/install", installs);
app.route("/api/rate", ratings);
app.route("/api/rating", ratings);
app.route("/api/stats", stats);
app.route("/api/webhooks", webhooks);
app.route("/api/identity", identity);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// 404 handler
app.notFound((c) =>
  c.json(
    {
      error: "NOT_FOUND",
      message: "The requested endpoint does not exist",
    },
    404
  )
);

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    500
  );
});

export default app;
