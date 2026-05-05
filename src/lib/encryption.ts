/**
 * ============================================================================
 * ENCRYPTION — AES-256-GCM
 * ============================================================================
 *
 * Used to encrypt bridge_credentials (each hotel's Supabase URL & keys)
 * before storing them in the central DB.
 *
 * Algorithm: AES-256-GCM (authenticated encryption, prevents tampering)
 * Format:    base64(iv || authTag || ciphertext)
 *            iv = 12 bytes (96 bits, recommended for GCM)
 *            authTag = 16 bytes
 *
 * Master key: ENCRYPTION_MASTER_KEY env var (64 hex chars = 32 bytes = 256 bits)
 * ============================================================================
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// ----------------------------------------------------------------------------
// KEY MANAGEMENT
// ----------------------------------------------------------------------------

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY env var is missing. Generate with: openssl rand -hex 32'
    );
  }
  if (hex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes). Got ${hex.length}.`
    );
  }

  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

// ----------------------------------------------------------------------------
// ENCRYPT
// ----------------------------------------------------------------------------

export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Cannot encrypt empty string');
  }

  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: iv || authTag || ciphertext
  const combined = Buffer.concat([iv, authTag, ciphertext]);
  return combined.toString('base64');
}

// ----------------------------------------------------------------------------
// DECRYPT
// ----------------------------------------------------------------------------

export async function decryptCredential(encrypted: string): Promise<string> {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty string');
  }

  const key = getMasterKey();
  const combined = Buffer.from(encrypted, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

// ----------------------------------------------------------------------------
// UTILITY: Test encryption round-trip
// ----------------------------------------------------------------------------

export async function testEncryptionRoundTrip(): Promise<boolean> {
  const sample = `test-${Date.now()}`;
  const encrypted = await encryptCredential(sample);
  const decrypted = await decryptCredential(encrypted);
  return decrypted === sample;
}
