import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { isPublicWorkerRoute, isWorkerProxyToken, WORKER_CLIENT_HEADER, WORKER_PROXY_HEADER } from "@proofbound/shared/worker-api";
import { invariant } from "./errors.ts";

const minute = 60_000;

export function createProxyAccess(token: string) {
  const expected = Buffer.from(token, "hex");
  const counts = new Map<string, number>();
  let window = -1;

  function limit(key: string, maximum: number) {
    const current = Math.floor(Date.now() / minute);
    if (current !== window) {
      counts.clear();
      window = current;
    }
    const count = counts.get(key) ?? 0;
    invariant(count < maximum, "RATE_LIMIT", "Too many requests. Try again in a minute.", 429);
    counts.set(key, count + 1);
  }

  return {
    check(req: IncomingMessage, method: string, pathname: string, origin: string) {
      const provided = req.headers[WORKER_PROXY_HEADER];
      invariant(typeof provided === "string" && isWorkerProxyToken(provided) &&
        timingSafeEqual(expected, Buffer.from(provided, "hex")),
      "PROXY_AUTH_REQUIRED", "Authorized frontend required.", 401);
      invariant(isPublicWorkerRoute(method, pathname), "NOT_FOUND", "No route matches this request.", 404);
      invariant((method === "GET" && req.headers.origin === undefined) || req.headers.origin === origin,
        "ORIGIN_DENIED", "This request must come from the configured application origin.", 403);
      const forwarded = req.headers[WORKER_CLIENT_HEADER];
      const client = typeof forwarded === "string" && forwarded.length <= 45 && isIP(forwarded) ? forwarded : "unknown";
      limit("all", 240);
      limit(`ip:${client}`, 80);
      if (pathname.startsWith("/api/auth/")) limit(`auth:${client}`, 16);
      else if (method !== "GET") limit(`mutations:${client}`, 24);
    },
    limitAccount(accountId: string) {
      limit(`account:${accountId}`, 16);
    },
  };
}
