import { isIP } from "node:net";
import {
  isPublicWorkerRoute, isWorkerProxyToken, MAX_WORKER_BODY_BYTES, WORKER_CLIENT_HEADER, WORKER_PROXY_HEADER,
} from "@proofbound/shared/worker-api";
import type { NextRequest } from "next/server.js";
import { servePublicTestnet } from "../../../lib/public-testnet.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function rejected(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

function unavailable() {
  return rejected(503, "WORKER_UNAVAILABLE", "The agent worker is currently unavailable. Please try again later.");
}

async function readBody(request: NextRequest): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      size += value.byteLength;
      if (size > MAX_WORKER_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = `/api/${path.map(encodeURIComponent).join("/")}`;
  const method = request.method;
  if (process.env.PROOFBOUND_PUBLIC_TESTNET === "1") return servePublicTestnet(method, pathname);
  try {
    const worker = new URL(process.env.PROOFBOUND_WORKER_URL || "http://127.0.0.1:3001");
    const onVercel = process.env.VERCEL === "1";
    const remote = onVercel || !["127.0.0.1", "localhost", "[::1]"].includes(worker.hostname);
    const token = process.env.PROOFBOUND_WORKER_PROXY_TOKEN;
    if (!["https:", "http:"].includes(worker.protocol) || worker.username || worker.password ||
      (remote && (worker.protocol !== "https:" || !isWorkerProxyToken(token)))) {
      return unavailable();
    }
    const secured = remote || token !== undefined;
    const site = process.env.PROOFBOUND_WEB_ORIGIN;
    const siteOrigin = site ? new URL(site).origin : null;
    if (secured && (!siteOrigin || !isWorkerProxyToken(token) || (remote && !siteOrigin.startsWith("https://")))) {
      return unavailable();
    }
    const localRoute = !secured && ((method === "POST" && pathname === "/api/session/local") ||
      (method === "GET" && pathname === "/api/health"));
    if (!isPublicWorkerRoute(method, pathname) && !localRoute) {
      return rejected(404, "NOT_FOUND", "No route matches this request.");
    }

    const origin = request.headers.get("origin");
    if (secured && (request.headers.get("host") !== new URL(siteOrigin!).host ||
      ((method !== "GET" || origin !== null) && origin !== siteOrigin))) {
      return rejected(403, "ORIGIN_DENIED", "This request must come from the configured application origin.");
    }
    const headers = new Headers();
    for (const name of ["content-type", "cookie", "origin"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (token) headers.set(WORKER_PROXY_HEADER, token);
    const client = onVercel && request.headers.get("x-vercel-forwarded-for");
    if (client && isIP(client)) headers.set(WORKER_CLIENT_HEADER, client);

    let body: Uint8Array<ArrayBuffer> | undefined;
    if (method === "POST" || method === "PATCH") {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
        return rejected(415, "JSON_REQUIRED", "Send a JSON request.");
      }
      const input = await readBody(request);
      if (!input) return rejected(413, "BODY_TOO_LARGE", "Request body exceeds 16 KiB.");
      body = new Uint8Array(input);
    }
    const target = new URL(pathname + request.nextUrl.search, worker);
    const response = await fetch(target, {
      method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(25000),
    });
    if (!response.headers.get("content-type")?.startsWith("application/json")) return unavailable();
    if (secured && (response.status >= 500 || response.status === 401)) {
      const result = await response.json();
      const safeMessages: Record<string, string> = {
        WORKER_NOT_AUTHORIZED: "Testnet job execution is currently paused.",
        CHAIN_WRITES_DISABLED: "Testnet transactions are currently paused.",
        PROVIDER_CREDITS_EXHAUSTED: "Research is paused because the existing NEAR AI credits are unavailable.",
      };
      const code = result?.error?.code;
      if (response.status === 401 && code !== "PROXY_AUTH_REQUIRED") {
        return Response.json(result, { status: 401, headers: { "Cache-Control": "no-store" } });
      }
      return typeof code === "string" && Object.hasOwn(safeMessages, code)
        ? rejected(503, code, safeMessages[code])
        : unavailable();
    }
    const outgoing = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    for (const cookie of response.headers.getSetCookie()) outgoing.append("set-cookie", cookie);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return unavailable();
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
