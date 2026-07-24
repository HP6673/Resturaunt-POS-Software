import crypto from "crypto";

// PINs are stored reversibly (not hashed) so admins can view an employee's
// current PIN. This is a deliberate tradeoff: these are 6-digit codes for a
// shared tablet, not account passwords, and the readability is a requested
// feature. Never reuse this pattern for real passwords.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.PIN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("PIN_ENCRYPTION_KEY env var is not set");
  }
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32) {
    throw new Error("PIN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return key;
}

export function encryptPin(pin: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptPin(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
