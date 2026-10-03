import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Staff PIN and Paired device secrets. A PIN is low-entropy, so it is salted and slow-hashed (the
 * caller adds lockout); device tokens and pairing codes are high-entropy, so SHA-256 suffices.
 */

const SCRYPT_KEY_LENGTH = 32;
/** scrypt cost of a stored PIN hash (Node's defaults), spelled out so a client can reproduce it. */
export const PIN_KDF_PARAMS = { N: 16384, r: 8, p: 1, dkLen: SCRYPT_KEY_LENGTH } as const;
const SALT_BYTES = 16;
const PIN_PATTERN = /^\d{4,6}$/;
/** No `0/O/1/I` so a code read aloud or typed from a screen is not misread. */
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_CODE_LENGTH = 8;

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      pin,
      salt,
      PIN_KDF_PARAMS.dkLen,
      { N: PIN_KDF_PARAMS.N, r: PIN_KDF_PARAMS.r, p: PIN_KDF_PARAMS.p },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** A PIN is 4 to 6 digits. */
export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/** `salt:hash` (hex), the only form of a PIN ever written to storage. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(pin, salt);
  return `${Buffer.from(salt).toString("hex")}:${Buffer.from(key).toString("hex")}`;
}

/** Constant-time check of a candidate PIN against a stored hash; a malformed hash never matches. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== SCRYPT_KEY_LENGTH) {
    return false;
  }
  const actual = await derive(pin, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

/** Salt (hex) and key of a stored `salt:hash`, or null. The key is server-only, equivalent to the hash. */
export function parseStoredPin(stored: string): { saltHex: string; key: Buffer } | null {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) {
    return null;
  }
  const key = Buffer.from(keyHex, "hex");
  return key.length === SCRYPT_KEY_LENGTH ? { saltHex, key } : null;
}

/** A URL-safe 256-bit secret, shown once to its holder. */
export function generateSecretToken(): string {
  return Buffer.from(randomBytes(32)).toString("base64url");
}

/** SHA-256 hex digest of a high-entropy secret (device token, pairing code). */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** A short one-time code a person types into the device being paired. */
export function generatePairingCode(): string {
  let code = "";
  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return code;
}
