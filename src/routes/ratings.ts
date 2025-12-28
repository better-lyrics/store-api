import { Hono } from "hono";
import type { Env, ErrorResponse, RatingStats } from "../lib/types";
import { verifySignature, isTimestampFresh, verifyKeyId } from "../lib/crypto";
import { getPublicKey, registerPublicKey } from "../lib/publicKeys";
import { upsertRating, hasRating, getRatingStats } from "../lib/ratings";
import { isValidThemeId, isValidSignedRatingBody } from "../lib/validation";

const ratings = new Hono<{ Bindings: Env }>();

const RATE_LIMIT_TTL = 60 * 60;
const RATE_LIMIT_MAX = 10;

ratings.post("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");

  if (!isValidThemeId(themeId)) {
    return c.json<ErrorResponse>(
      { error: "INVALID_THEME_ID", message: "Theme ID must be alphanumeric with hyphens only" },
      400
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>(
      { error: "INVALID_JSON", message: "Request body must be valid JSON" },
      400
    );
  }

  if (!isValidSignedRatingBody(body)) {
    return c.json<ErrorResponse>(
      { error: "INVALID_REQUEST", message: "Request must include valid payload and signature" },
      400
    );
  }

  const { payload, signature, publicKey } = body;

  if (payload.themeId !== themeId) {
    return c.json<ErrorResponse>(
      { error: "THEME_MISMATCH", message: "Payload themeId must match URL parameter" },
      400
    );
  }

  if (!isTimestampFresh(payload.timestamp)) {
    return c.json<ErrorResponse>(
      { error: "TIMESTAMP_EXPIRED", message: "Request timestamp is too old or too far in the future" },
      400
    );
  }

  let keyRecord = await getPublicKey(c.env.DB, payload.keyId);

  if (!keyRecord) {
    if (!publicKey) {
      return c.json<ErrorResponse>(
        { error: "PUBLIC_KEY_REQUIRED", message: "Public key is required for first-time registration" },
        400
      );
    }

    if (!(await verifyKeyId(payload.keyId, publicKey))) {
      return c.json<ErrorResponse>(
        { error: "KEY_ID_MISMATCH", message: "Key ID does not match the provided public key" },
        400
      );
    }

    keyRecord = await registerPublicKey(c.env.DB, payload.keyId, publicKey);
  }

  const storedKey = JSON.parse(keyRecord.public_key) as JsonWebKey;
  if (!(await verifySignature(payload, signature, storedKey))) {
    return c.json<ErrorResponse>(
      { error: "INVALID_SIGNATURE", message: "Signature verification failed" },
      403
    );
  }

  if (!(await hasRating(c.env.DB, themeId, payload.keyId))) {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const rateLimitKey = `ratelimit:rate:${ip}`;
    const currentCount = parseInt((await c.env.KV.get(rateLimitKey)) || "0", 10);

    if (currentCount >= RATE_LIMIT_MAX) {
      return c.json<ErrorResponse>(
        { error: "RATE_LIMITED", message: "Too many new ratings, please try again later" },
        429
      );
    }

    await c.env.KV.put(rateLimitKey, (currentCount + 1).toString(), {
      expirationTtl: RATE_LIMIT_TTL
    });
  }

  await upsertRating(c.env.DB, themeId, payload.keyId, payload.rating);

  return c.json<RatingStats>(await getRatingStats(c.env.DB, themeId));
});

ratings.get("/:themeId", async (c) => {
  const themeId = c.req.param("themeId");

  if (!isValidThemeId(themeId)) {
    return c.json<ErrorResponse>(
      { error: "INVALID_THEME_ID", message: "Theme ID must be alphanumeric with hyphens only" },
      400
    );
  }

  return c.json<RatingStats>(await getRatingStats(c.env.DB, themeId));
});

export default ratings;
