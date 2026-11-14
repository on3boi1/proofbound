export const WORKER_PROXY_HEADER = "x-proofbound-worker-token";
export const WORKER_CLIENT_HEADER = "x-proofbound-client-ip";
export const MAX_WORKER_BODY_BYTES = 16_384;

const id = "[a-zA-Z0-9_-]{1,100}";
const publicWorkerRoutes: Record<string, RegExp> = {
  GET: new RegExp(`^/api/(?:bootstrap|agents(?:/${id})?|passport/${id}|jobs(?:/${id}(?:/proof)?)?)$`),
  POST: new RegExp(`^/api/(?:auth/(?:challenge|verify)|transactions/confirm|agents(?:/${id}/(?:topup|transfer|security-check))?|jobs(?:/quote|/${id}/(?:cancel|expire))?|withdraw)$`),
  PATCH: new RegExp(`^/api/agents/${id}$`),
  DELETE: /^\/api\/session$/,
};

export function isPublicWorkerRoute(method: string, path: string): boolean {
  return Object.hasOwn(publicWorkerRoutes, method) && publicWorkerRoutes[method].test(path);
}

export function isWorkerProxyToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
