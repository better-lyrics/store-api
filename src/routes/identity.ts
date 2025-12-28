import { Hono } from "hono";
import type { Env, ErrorResponse } from "../lib/types";
import { getPublicKey } from "../lib/publicKeys";
import { isValidKeyId } from "../lib/validation";

const identity = new Hono<{ Bindings: Env }>();

identity.get("/:keyId", async (c) => {
  const keyId = c.req.param("keyId");

  if (!isValidKeyId(keyId)) {
    return c.json<ErrorResponse>(
      { error: "INVALID_KEY_ID", message: "Key ID must be a 64-character hex string" },
      400
    );
  }

  const record = await getPublicKey(c.env.DB, keyId);

  if (!record) {
    return c.json<ErrorResponse>(
      { error: "NOT_FOUND", message: "Identity not found" },
      404
    );
  }

  return c.json({
    keyId: record.key_id,
    displayName: record.display_name,
    createdAt: record.created_at
  });
});

export default identity;
