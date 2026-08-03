/**
 * Application-level secret encryption (AES-256-GCM) for OAuth refresh tokens,
 * connector credentials, and other secrets stored at rest in MongoDB.
 *
 * Key: APP_ENCRYPTION_KEY — a 32-byte key provided as 64-hex or base64. Rotate by
 * re-encrypting; the `v` field in the envelope allows future multi-key rotation.
 */
import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";

export interface SealedSecret {
  v: 1; // envelope version (for future key rotation)
  iv: string; // base64
  tag: string; // base64 auth tag
  ct: string; // base64 ciphertext
}

function key(): Buffer {
  const raw = env.APP_ENCRYPTION_KEY();
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set — required to encrypt/decrypt connector secrets.",
    );
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (256-bit).");
  }
  return buf;
}

export function isEncryptionConfigured(): boolean {
  return Boolean(env.APP_ENCRYPTION_KEY());
}

export function seal(plaintext: string): SealedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString("base64"), tag: tag.toString("base64"), ct: ct.toString("base64") };
}

export function open(sealed: SealedSecret): string {
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(sealed.ct, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** Generate a fresh 32-byte key (hex) — for `openssl rand -hex 32` parity. */
export function generateKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
