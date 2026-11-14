import { createHash } from "node:crypto";
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  const record=value as Record<string,unknown>;
  return "{"+Object.keys(record).filter(k=>record[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+canonical(record[k])).join(",")+"}";
}
export function sha256(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
export function hashObject(value: unknown): string { return sha256(canonical(value)); }
