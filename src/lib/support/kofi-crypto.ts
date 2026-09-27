import { createHash, randomBytes } from "node:crypto";

export function hashSupportCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code.trim().toUpperCase()}`).digest("hex");
}

export function generateSupportCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}
