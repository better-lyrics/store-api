import type { Env } from "./types";

// Base for fetching the published theme registry from GitHub raw.
// Reused for both index.json (webhooks) and index.lock.json (resolver).
export const REGISTRY_RAW_BASE =
  "https://raw.githubusercontent.com/better-lyrics/themes/master";

// KV cache key for the parsed lockfile. Short TTL keeps resolves cheap while
// staying fresh; the webhook /complete handler busts it on publish.
export const LOCKFILE_CACHE_KEY = "resolve:index.lock.json";
export const LOCKFILE_CACHE_TTL_SECONDS = 300;

export interface LockfileBuild {
  version: string;
  // 4-part minimum extension version (e.g. "2.2.0.0"). Absent on legacy builds.
  minVersion?: string;
  // "themes/<id>" for latest, "themes/<id>/v/<version>" for a snapshot.
  path: string;
  integrity: string;
}

export interface LockfileEntry {
  repo: string;
  id: string;
  version: string;
  commit: string;
  integrity: string;
  locked: string;
  // Additive field. Absent on legacy entries not yet re-vendored.
  builds?: LockfileBuild[];
}

export interface Lockfile {
  themes: LockfileEntry[];
}

export interface ResolvedBuild {
  version: string;
  minVersion?: string;
  path: string;
  integrity: string;
}

// Compare two dotted numeric versions part by part. Differing part counts are
// allowed: missing trailing parts count as 0, so "2.3" === "2.3.0.0".
// Returns negative if a < b, positive if a > b, 0 if equal.
export function versionCompare(a: string, b: string): number {
  const partsA = a.split(".");
  const partsB = b.split(".");
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const numA = Number.parseInt(partsA[i] ?? "0", 10) || 0;
    const numB = Number.parseInt(partsB[i] ?? "0", 10) || 0;
    if (numA !== numB) {
      return numA < numB ? -1 : 1;
    }
  }

  return 0;
}

// From a lockfile entry, pick the build with the highest version whose
// minVersion floor is cleared by ext. A build with no minVersion has no floor
// and always qualifies. Legacy entries (no builds[]) synthesize a single
// latest build, matching today's latest-wins behavior. Returns null when ext
// clears no build's floor.
export function resolveBuild(
  entry: LockfileEntry,
  ext: string
): ResolvedBuild | null {
  const builds: LockfileBuild[] =
    entry.builds && entry.builds.length > 0
      ? entry.builds
      : [
          {
            version: entry.version,
            minVersion: undefined,
            path: `themes/${entry.id}`,
            integrity: entry.integrity,
          },
        ];

  let winner: LockfileBuild | null = null;

  for (const build of builds) {
    if (build.minVersion && versionCompare(ext, build.minVersion) < 0) {
      continue;
    }
    if (winner === null || versionCompare(build.version, winner.version) > 0) {
      winner = build;
    }
  }

  if (winner === null) {
    return null;
  }

  return {
    version: winner.version,
    minVersion: winner.minVersion,
    path: winner.path,
    integrity: winner.integrity,
  };
}

// Fetch the registry lockfile, preferring a cached parse in KV. On a cache
// miss, fetch from GitHub raw, store the parsed result under a short TTL, and
// return it.
export async function getLockfile(env: Env): Promise<Lockfile> {
  const cached = await env.KV.get<Lockfile>(LOCKFILE_CACHE_KEY, "json");
  if (cached) {
    return cached;
  }

  const response = await fetch(`${REGISTRY_RAW_BASE}/index.lock.json`, {
    headers: { "User-Agent": "better-lyrics-store-api" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch theme registry lockfile");
  }

  const lockfile = (await response.json()) as Lockfile;

  await env.KV.put(LOCKFILE_CACHE_KEY, JSON.stringify(lockfile), {
    expirationTtl: LOCKFILE_CACHE_TTL_SECONDS,
  });

  return lockfile;
}

// Remove the cached lockfile so the next resolve re-fetches a freshly published
// build. Called from the webhook /complete handler after a successful vendor.
export async function bustLockfileCache(env: Env): Promise<void> {
  await env.KV.delete(LOCKFILE_CACHE_KEY);
}
