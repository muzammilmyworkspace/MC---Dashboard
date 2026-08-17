/* ------------------------------------------------------------------ *
 *  .env hygiene checks — run once at boot.
 *
 *  Reports variable NAMES and line numbers only. Values are never read
 *  into a message, logged, or returned.
 * ------------------------------------------------------------------ */
import fs from "node:fs";
import path from "node:path";

/**
 * Warns when a key is declared more than once.
 *
 * dotenv keeps the LAST occurrence, so a second declaration silently beats
 * the first. An empty duplicate appended below a filled-in value therefore
 * blanks it with no error anywhere — the variable simply reads as unset.
 * This has already cost one debugging session; it should never be silent.
 */
export function assertNoDuplicateEnvKeys(envPath = path.resolve(process.cwd(), ".env")): string[] {
  let contents: string;
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    return []; // No .env (container/CI supplies real env vars) — nothing to audit.
  }

  const seen = new Map<string, number[]>();

  contents.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    seen.set(key, [...(seen.get(key) ?? []), i + 1]);
  });

  const duplicates = [...seen.entries()].filter(([, lines]) => lines.length > 1);
  if (duplicates.length === 0) return [];

  console.error(
    `\n  ⚠  Duplicate keys in ${path.basename(envPath)} — dotenv keeps the LAST one:\n` +
      duplicates.map(([key, lines]) => `     • ${key} (lines ${lines.join(", ")})`).join("\n") +
      `\n     Delete the extra declarations, keeping the one with the value you want.\n`
  );

  return duplicates.map(([key]) => key);
}
