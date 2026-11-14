export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options, credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let data;
  try { data = await response.json(); } catch { throw new ApiError("INVALID_RESPONSE", "The service returned an unreadable response. Please retry.", response.status); }
  if (!response.ok) throw new ApiError(data.error?.code || "REQUEST_FAILED", data.error?.message || "The request could not be completed.", response.status);
  return data as T;
}

export function shortId(id: string, length = 8) { return id.length > length * 2 + 2 ? `${id.slice(0, length)}…${id.slice(-length)}` : id; }
export function dateTime(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
export function number(value: number) { return new Intl.NumberFormat("en").format(value); }
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please retry."; }
