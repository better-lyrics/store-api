import { Hono } from "hono";
import type { Env, ErrorResponse, UserRatingsResponse } from "../lib/types";
import { verifySignature, isTimestampFresh } from "../lib/crypto";
import { getPublicKey } from "../lib/publicKeys";
import { getUserRatings } from "../lib/ratings";
import { isValidUserRatingsBody } from "../lib/validation";

const user = new Hono<{ Bindings: Env }>();

const RATE_LIMIT_TTL = 60;
const RATE_LIMIT_MAX = 30;

user.post("/ratings", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>(
      { error: "INVALID_JSON", message: "Request body must be valid JSON" },
      400
    );
  }

  if (!isValidUserRatingsBody(body)) {
    return c.json<ErrorResponse>(
      { error: "INVALID_REQUEST", message: "Request must include valid payload and signature" },
      400
    );
  }

  const { payload, signature } = body;

  if (!isTimestampFresh(payload.timestamp)) {
    return c.json<ErrorResponse>(
      { error: "TIMESTAMP_EXPIRED", message: "Request timestamp is too old or too far in the future" },
      400
    );
  }

  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `ratelimit:user-ratings:${ip}`;
  const currentCount = parseInt((await c.env.KV.get(rateLimitKey)) || "0", 10);

  if (currentCount >= RATE_LIMIT_MAX) {
    return c.json<ErrorResponse>(
      { error: "RATE_LIMITED", message: "Too many requests, please try again later" },
      429
    );
  }

  const keyRecord = await getPublicKey(c.env.DB, payload.keyId);
  if (!keyRecord) {
    return c.json<ErrorResponse>(
      { error: "KEY_NOT_FOUND", message: "No identity found for this key ID" },
      404
    );
  }

  const storedKey = JSON.parse(keyRecord.public_key) as JsonWebKey;
  if (!(await verifySignature(payload, signature, storedKey))) {
    return c.json<ErrorResponse>(
      { error: "INVALID_SIGNATURE", message: "Signature verification failed" },
      403
    );
  }

  await c.env.KV.put(rateLimitKey, (currentCount + 1).toString(), {
    expirationTtl: RATE_LIMIT_TTL,
  });

  return c.json<UserRatingsResponse>(await getUserRatings(c.env.DB, payload.keyId));
});

export default user;
