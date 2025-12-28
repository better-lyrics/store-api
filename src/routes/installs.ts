import { Hono } from "hono";
import type { Env, InstallResponse, ErrorResponse } from "../lib/types";
import { verifySignature, isTimestampFresh, verifyKeyId } from "../lib/crypto";
import { getPublicKey, registerPublicKey } from "../lib/publicKeys";
import { isValidThemeId, isValidSignedInstallBody } from "../lib/validation";

const installs = new Hono<{ Bindings: Env }>();


installs.post("/:themeId", async (c) => {
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

  if (!isValidSignedInstallBody(body)) {
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

  const installMarkerKey = `installed:${payload.keyId}:${themeId}`;
  const existing = await c.env.KV.get(installMarkerKey);
  if (existing) {
    const installKey = `installs:${themeId}`;
    const currentCount = parseInt((await c.env.KV.get(installKey)) || "0", 10) || 0;
    return c.json<InstallResponse>({ count: currentCount, alreadyCounted: true });
  }

  const installKey = `installs:${themeId}`;
  const currentCount = await c.env.KV.get(installKey);
  const newCount = (parseInt(currentCount || "0", 10) || 0) + 1;

  await Promise.all([
    c.env.KV.put(installKey, newCount.toString()),
    c.env.KV.put(installMarkerKey, "1"),
  ]);

  return c.json<InstallResponse>({ count: newCount });
});

export default installs;
