import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const worker = process.env.PROOFBOUND_WORKER_URL || "http://127.0.0.1:3001";
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, worker);
  const headers = new Headers();
  for (const name of ["content-type", "cookie", "origin", "authorization", "x-csrf-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-host", request.headers.get("host") || request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  try {
    const response = await fetch(target, {
      method: request.method, headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000),
    });
    const outgoing = new Headers({ "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
    for (const cookie of response.headers.getSetCookie()) outgoing.append("set-cookie", cookie);
    return new Response(await response.arrayBuffer(), { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ error: { code: "WORKER_UNAVAILABLE", message: "The agent worker is unavailable. Start the worker and retry." } }, { status: 503 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
