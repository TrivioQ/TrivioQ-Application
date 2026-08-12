import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_MASTER_KEY is not set. Generate one with: openssl rand -hex 32');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes.`);
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a single opaque base64 string: base64(iv || ciphertext || authTag).
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/**
 * Decrypt an envelope produced by {@link encrypt}.
 * Throws if the key is wrong, the tag fails, or the payload is tampered.
 */
export function decrypt(blob: string): string {
  let parts: Buffer;
  try {
    parts = Buffer.from(blob, 'base64');
  } catch {
    throw new Error('Failed to decode apiKeyCipher (invalid base64).');
  }
  if (parts.length < IV_LEN + TAG_LEN) {
    throw new Error('apiKeyCipher payload is too short.');
  }
  const iv = parts.subarray(0, IV_LEN);
  const tag = parts.subarray(parts.length - TAG_LEN);
  const ciphertext = parts.subarray(IV_LEN, parts.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}

/** Mask a decrypted key for display: shows last 4 chars only. */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}

/** Returns a masked preview of the apiKeyCipher without exposing the key. */
export function maskCipher(cipher: string | null | undefined): string | null {
  if (!cipher) return null;
  try {
    return maskKey(decrypt(cipher));
  } catch {
    return '••••';
  }
}
