import crypto from "node:crypto";
import { env } from "../env.js";

/**
 * AES-256-GCM envelope encryption for provider credentials.
 * Format: v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 *
 * The key comes from ENCRYPTION_KEY (64 hex chars = 32 bytes). In development
 * a key is derived from the JWT secret so the app still runs, but production
 * must set an explicit key.
 */
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (raw && /^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  // Deterministic fallback so local dev works without extra setup.
  return crypto.createHash("sha256").update(env.JWT_ACCESS_SECRET).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}

/** Timing-safe comparison for webhook signatures. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** GitHub sends `sha256=<hmac>` in X-Hub-Signature-256. */
export function verifyGithubSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return safeEqual(digest, signature);
}

/** Vercel signs with sha1 HMAC in x-vercel-signature. */
export function verifyVercelSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  return safeEqual(digest, signature);
}

/** Masks a secret for display: keeps the last 4 characters. */
export function mask(value: string | null | undefined): string {
  if (!value) return "";
  return value.length <= 4 ? "••••" : `••••••••${value.slice(-4)}`;
}
