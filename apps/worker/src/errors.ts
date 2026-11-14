export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function invariant(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
export function boundedInteger(value: unknown, min: number, max: number, name: string): number {
  invariant(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max, "INVALID_INPUT", `${name} must be an integer from ${min} to ${max}.`);
  return value;
}
export function amount(value: unknown, name = "Amount"): bigint {
  invariant(typeof value === "string" && /^\d{1,39}$/.test(value), "INVALID_AMOUNT", `${name} must be an integer yoctoNEAR string.`);
  const n = BigInt(value); invariant(n <= (1n << 128n) - 1n, "INVALID_AMOUNT", `${name} exceeds u128.`); return n;
}
export function boundedText(value: unknown, min: number, max: number, name: string): string {
  invariant(typeof value === "string" && value.trim().length >= min && value.length <= max, "INVALID_INPUT", `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
