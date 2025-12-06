import type { Env } from "./types";

interface JWTHeader {
  alg: "RS256";
  typ: "JWT";
}

interface JWTPayload {
  iat: number;
  exp: number;
  iss: string;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createJWT(appId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header: JWTHeader = { alg: "RS256", typ: "JWT" };
  const payload: JWTPayload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message)
  );

  return `${message}.${base64UrlEncode(signature)}`;
}

const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export async function getInstallationToken(
  env: Env,
  installationId: number
): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const jwt = await createJWT(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "better-lyrics-store-api",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();

  tokenCache.set(installationId, { token: data.token, expiresAt });

  return data.token;
}

export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const digest =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  if (signature.length !== digest.length) return false;

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ digest.charCodeAt(i);
  }
  return result === 0;
}

export async function setCommitStatus(
  env: Env,
  installationId: number,
  options: {
    repo: string;
    commit: string;
    state: "pending" | "success" | "failure" | "error";
    description: string;
    context: string;
    targetUrl?: string;
  }
): Promise<void> {
  const token = await getInstallationToken(env, installationId);

  const response = await fetch(
    `https://api.github.com/repos/${options.repo}/statuses/${options.commit}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "better-lyrics-store-api",
      },
      body: JSON.stringify({
        state: options.state,
        description: options.description,
        context: options.context,
        target_url: options.targetUrl,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Failed to set commit status:", response.status, text);
  }
}

export async function triggerRegistryDispatch(
  env: Env,
  installationId: number,
  payload: {
    repo: string;
    commit: string;
  }
): Promise<void> {
  const token = await getInstallationToken(env, installationId);

  const response = await fetch(
    "https://api.github.com/repos/better-lyrics/themes/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "better-lyrics-store-api",
      },
      body: JSON.stringify({
        event_type: "theme-update",
        client_payload: payload,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger dispatch: ${response.status} ${text}`);
  }
}
