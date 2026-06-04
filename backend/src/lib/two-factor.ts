import * as otplib from "otplib";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "./crypto";

const RECOVERY_CODES_COUNT = 8;
const RECOVERY_CODES_LENGTH = 10;

export function generateSecret(): string {
  return otplib.generateSecret();
}

export function generateTOTPUri(secret: string, email: string, issuer = "MeleFlow"): string {
  return otplib.generateURI({
    issuer,
    label: email,
    secret,
    strategy: "totp",
    digits: 6,
    period: 30,
  });
}

export async function verifyTOTP(token: string, encryptedSecret: string): Promise<boolean> {
  try {
    const secret = decrypt(encryptedSecret);
    const result = await otplib.verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export function encryptSecret(secret: string): string {
  return encrypt(secret);
}

export function decryptSecret(encrypted: string): string {
  return decrypt(encrypted);
}

export async function generateRecoveryCodes(): Promise<{
  plainCodes: string[];
  hashedCodes: string;
}> {
  const codes: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < RECOVERY_CODES_COUNT; i++) {
    const code = crypto.randomBytes(RECOVERY_CODES_LENGTH).toString("hex").slice(0, RECOVERY_CODES_LENGTH).toUpperCase();
    codes.push(code);
    const hash = await bcrypt.hash(code, 10);
    hashed.push(hash);
  }

  return {
    plainCodes: codes,
    hashedCodes: JSON.stringify(hashed),
  };
}

export async function verifyRecoveryCode(
  code: string,
  storedHashedJson: string | null,
): Promise<{ valid: boolean; remainingCodesJson: string | null }> {
  if (!storedHashedJson) return { valid: false, remainingCodesJson: null };

  const hashedCodes: string[] = JSON.parse(storedHashedJson);

  for (let i = 0; i < hashedCodes.length; i++) {
    const valid = await bcrypt.compare(code.toUpperCase(), hashedCodes[i]);
    if (valid) {
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return {
        valid: true,
        remainingCodesJson: remaining.length > 0 ? JSON.stringify(remaining) : null,
      };
    }
  }

  return { valid: false, remainingCodesJson: null };
}
