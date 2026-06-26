import assert from "node:assert/strict";
import {
  versionCompare,
  resolveBuild,
  type LockfileEntry,
} from "./resolve";

// Runnable assert-based self-check for the pure resolver logic.
// Run with: npx tsx src/lib/resolve.selfcheck.ts

// versionCompare: equal, ordering, and mixed part counts.
assert.equal(versionCompare("2.3.2", "2.3.2"), 0);
assert.equal(versionCompare("2.3", "2.3.0.0"), 0, "missing parts count as 0");
assert.equal(versionCompare("2.3.2.0", "2.3.2"), 0, "4-part vs 3-part equal");
assert.ok(versionCompare("2.3.2", "2.2.0.0") > 0, "newer minor wins");
assert.ok(versionCompare("2.2.0.0", "2.3.2") < 0, "older minor loses");
assert.ok(versionCompare("2.3.10", "2.3.9") > 0, "numeric not lexical");
assert.ok(versionCompare("2.4", "2.3.99") > 0, "minor beats large patch");

// resolveBuild: picks highest qualifying version (floor cleared by ext).
const multiBuild: LockfileEntry = {
  repo: "owner/repo",
  id: "demo",
  version: "3.0.0",
  commit: "abc",
  integrity: "sha256-new",
  locked: "2026-01-01T00:00:00Z",
  builds: [
    {
      version: "1.0.0",
      minVersion: undefined,
      path: "themes/demo/v/1.0.0",
      integrity: "sha256-old",
    },
    {
      version: "2.0.0",
      minVersion: "2.2.0.0",
      path: "themes/demo/v/2.0.0",
      integrity: "sha256-mid",
    },
    {
      version: "3.0.0",
      minVersion: "2.3.0.0",
      path: "themes/demo",
      integrity: "sha256-new",
    },
  ],
};

// ext clears the newest floor: highest version wins.
const newest = resolveBuild(multiBuild, "2.3.2");
assert.ok(newest !== null);
assert.equal(newest.version, "3.0.0");
assert.equal(newest.path, "themes/demo");
assert.equal(newest.integrity, "sha256-new");

// ext clears the mid floor but not the newest: mid wins.
const mid = resolveBuild(multiBuild, "2.2.5");
assert.ok(mid !== null);
assert.equal(mid.version, "2.0.0");
assert.equal(mid.path, "themes/demo/v/2.0.0");

// ext too old for any floored build: falls back to the unfloored build.
const floor = resolveBuild(multiBuild, "2.1.0");
assert.ok(floor !== null);
assert.equal(floor.version, "1.0.0");
assert.equal(floor.minVersion, undefined);

// Legacy entry without builds[] synthesizes one latest build.
const legacy: LockfileEntry = {
  repo: "owner/legacy",
  id: "legacy",
  version: "1.7.6",
  commit: "def",
  integrity: "sha256-legacy",
  locked: "2026-06-20T00:00:00Z",
};
const legacyBuild = resolveBuild(legacy, "2.3.2");
assert.ok(legacyBuild !== null);
assert.equal(legacyBuild.version, "1.7.6");
assert.equal(legacyBuild.minVersion, undefined);
assert.equal(legacyBuild.path, "themes/legacy");
assert.equal(legacyBuild.integrity, "sha256-legacy");

// Every floored build out of reach and no unfloored build: returns null.
const allFloored: LockfileEntry = {
  repo: "owner/floored",
  id: "floored",
  version: "2.0.0",
  commit: "ghi",
  integrity: "sha256-x",
  locked: "2026-01-01T00:00:00Z",
  builds: [
    {
      version: "2.0.0",
      minVersion: "9.9.9.9",
      path: "themes/floored",
      integrity: "sha256-x",
    },
  ],
};
assert.equal(resolveBuild(allFloored, "2.3.2"), null);

console.log("resolve self-check passed");
