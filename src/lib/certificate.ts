const CERTIFICATE_ISSUER = "better-lyrics-themes-api";

export interface Certificate {
  keyId: string;
  issuedAt: number;
  expiresAt: number | null;
  issuer: string;
}

export async function issueCertificate(
  keyId: string,
  signingKey: string
): Promise<string> {
  const cert: Certificate = {
    keyId,
    issuedAt: Date.now(),
    expiresAt: null,
    issuer: CERTIFICATE_ISSUER,
  };

  const certJson = JSON.stringify(cert);
  const signature = await signData(certJson, signingKey);
  return btoa(certJson) + "." + signature;
}

export async function verifyCertificate(
  certificate: string,
  keyId: string,
  signingKey: string
): Promise<boolean> {
  try {
    const [certB64, signature] = certificate.split(".");
    if (!certB64 || !signature) return false;

    const certJson = atob(certB64);
    const isValid = await verifyData(certJson, signature, signingKey);
    if (!isValid) return false;

    const cert: Certificate = JSON.parse(certJson);
    if (cert.keyId !== keyId) return false;
    if (cert.issuer !== CERTIFICATE_ISSUER) return false;
    if (cert.expiresAt && cert.expiresAt < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

async function signData(data: string, secretKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  return bufferToBase64(signature);
}

async function verifyData(
  data: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBuffer = base64ToBuffer(signature);
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    new TextEncoder().encode(data)
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
