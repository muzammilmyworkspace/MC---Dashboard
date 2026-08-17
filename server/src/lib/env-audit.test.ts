/* ------------------------------------------------------------------ *
 *  .env duplicate-key detection
 *
 *  Regression cover for the failure that made the dashboard read
 *  "Not Connected": an appended `META_APP_ID=` with no value sat below a
 *  filled-in one, dotenv kept the last occurrence, and the credential
 *  silently read as unset with no error anywhere.
 * ------------------------------------------------------------------ */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { assertNoDuplicateEnvKeys } = await import("./env-audit.js");

function withEnvFile(contents: string, run: (file: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-env-"));
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, contents, "utf8");
  try {
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("duplicate env keys", () => {
  it("detects a key declared twice", () => {
    withEnvFile("META_APP_ID=123456\nOTHER=x\nMETA_APP_ID=\n", (file) => {
      assert.deepEqual(assertNoDuplicateEnvKeys(file), ["META_APP_ID"]);
    });
  });

  it("reports every duplicated key", () => {
    withEnvFile("A=1\nB=2\nA=3\nB=4\nC=5\n", (file) => {
      assert.deepEqual(assertNoDuplicateEnvKeys(file).sort(), ["A", "B"]);
    });
  });

  it("passes a clean file", () => {
    withEnvFile("A=1\nB=2\n# A=3 commented out\n\n", (file) => {
      assert.deepEqual(assertNoDuplicateEnvKeys(file), []);
    });
  });

  it("ignores comments and blank lines", () => {
    withEnvFile("# META_APP_ID=old\nMETA_APP_ID=1\n\n#META_APP_ID=older\n", (file) => {
      assert.deepEqual(assertNoDuplicateEnvKeys(file), []);
    });
  });

  it("treats an indented declaration as the same key", () => {
    withEnvFile("META_APP_ID=1\n  META_APP_ID=2\n", (file) => {
      assert.deepEqual(assertNoDuplicateEnvKeys(file), ["META_APP_ID"]);
    });
  });

  it("returns empty when there is no .env at all", () => {
    assert.deepEqual(assertNoDuplicateEnvKeys(path.join(os.tmpdir(), "definitely-absent-.env")), []);
  });

  it("never puts a value in the returned data", () => {
    withEnvFile("SECRET_KEY=super-secret-value\nSECRET_KEY=another-secret\n", (file) => {
      const result = assertNoDuplicateEnvKeys(file);
      assert.deepEqual(result, ["SECRET_KEY"]);
      assert.ok(!JSON.stringify(result).includes("super-secret-value"));
    });
  });
});
