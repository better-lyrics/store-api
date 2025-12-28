import type { SignedRatingBody, SignedRatingPayload, SignedInstallBody, SignedInstallPayload } from "./types";

const THEME_ID_REGEX = /^[a-zA-Z0-9-]+$/;
const KEY_ID_REGEX = /^[0-9a-f]{64}$/i;
const NONCE_REGEX = /^[a-zA-Z0-9-_]{16,64}$/;

export function isValidThemeId(themeId: string): boolean {
  return (
    typeof themeId === "string" &&
    themeId.length > 0 &&
    themeId.length <= 100 &&
    THEME_ID_REGEX.test(themeId)
  );
}

export function isValidRating(rating: unknown): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

export function isValidKeyId(keyId: unknown): keyId is string {
  return typeof keyId === "string" && KEY_ID_REGEX.test(keyId);
}

export function isValidNonce(nonce: unknown): nonce is string {
  return typeof nonce === "string" && NONCE_REGEX.test(nonce);
}

export function isValidJwk(jwk: unknown): jwk is JsonWebKey {
  if (!jwk || typeof jwk !== "object") return false;

  const key = jwk as Record<string, unknown>;
  return (
    key.kty === "EC" &&
    key.crv === "P-256" &&
    typeof key.x === "string" &&
    typeof key.y === "string"
  );
}

function isValidPayload(payload: unknown): payload is SignedRatingPayload {
  if (!payload || typeof payload !== "object") return false;

  const p = payload as Record<string, unknown>;
  return (
    typeof p.themeId === "string" &&
    isValidThemeId(p.themeId) &&
    isValidRating(p.rating) &&
    typeof p.timestamp === "number" &&
    isValidNonce(p.nonce) &&
    isValidKeyId(p.keyId)
  );
}

export function isValidSignedRatingBody(body: unknown): body is SignedRatingBody {
  if (!body || typeof body !== "object") return false;

  const b = body as Record<string, unknown>;

  if (!isValidPayload(b.payload)) return false;
  if (typeof b.signature !== "string" || b.signature.length === 0) return false;
  if (b.publicKey !== undefined && !isValidJwk(b.publicKey)) return false;

  return true;
}

function isValidInstallPayload(payload: unknown): payload is SignedInstallPayload {
  if (!payload || typeof payload !== "object") return false;

  const p = payload as Record<string, unknown>;
  return (
    typeof p.themeId === "string" &&
    isValidThemeId(p.themeId) &&
    typeof p.timestamp === "number" &&
    isValidNonce(p.nonce) &&
    isValidKeyId(p.keyId)
  );
}

export function isValidSignedInstallBody(body: unknown): body is SignedInstallBody {
  if (!body || typeof body !== "object") return false;

  const b = body as Record<string, unknown>;

  if (!isValidInstallPayload(b.payload)) return false;
  if (typeof b.signature !== "string" || b.signature.length === 0) return false;
  if (b.publicKey !== undefined && !isValidJwk(b.publicKey)) return false;

  return true;
}
