const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const ECDSA_PARAMS = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;

export async function verifySignature(
  payload: object,
  signature: string,
  publicKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      ECDSA_PARAMS,
      false,
      ["verify"]
    );

    const signatureBuffer = base64ToBuffer(signature);
    const payloadBuffer = new TextEncoder().encode(canonicalJson(payload));

    return await crypto.subtle.verify(
      ECDSA_SIGN_PARAMS,
      key,
      signatureBuffer,
      payloadBuffer
    );
  } catch {
    return false;
  }
}

export function isTimestampFresh(timestamp: number): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= TIMESTAMP_TOLERANCE_MS;
}

export async function hashPublicKey(publicKeyJwk: JsonWebKey): Promise<string> {
  const canonical = canonicalJson(publicKeyJwk);
  const buffer = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(hash);
}

export async function verifyKeyId(
  keyId: string,
  publicKeyJwk: JsonWebKey
): Promise<boolean> {
  const computed = await hashPublicKey(publicKeyJwk);
  return computed.toLowerCase() === keyId.toLowerCase();
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(obj: object): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
