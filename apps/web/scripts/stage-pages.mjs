import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const staging = resolve(fileURLToPath(new URL("../../../.data/cloudflare-pages/", import.meta.url)));
const output = join(staging, "output");
if (dirname(output) !== staging) throw new Error("Pages output must be inside its staging directory");
const server = join(dist, "server");
const { main } = JSON.parse(await readFile(join(server, "wrangler.json"), "utf8"));
if (typeof main !== "string" || !/^index\.(m?js)$/.test(main)) {
  throw new Error("Unexpected Cloudflare Worker entry in the generated Vite configuration");
}
const configFile = new URL("../cloudflare-pages/wrangler.jsonc", import.meta.url);
const { vars } = JSON.parse(await readFile(configFile, "utf8"));
if (vars.PROOFBOUND_PUBLIC_TESTNET !== "1" || !vars.PROOFBOUND_PUBLIC_ORIGIN.startsWith("https://")) {
  throw new Error("The public Pages artifact requires read-only testnet mode and an HTTPS origin");
}

await mkdir(staging, { recursive: true });
await copyFile(configFile, join(staging, "wrangler.jsonc"));
await rm(output, { recursive: true, force: true });
await cp(join(dist, "client"), output, {
  recursive: true,
  filter: path => ![".vite", ".assetsignore"].includes(basename(path)),
});
await build({
  absWorkingDir: server,
  entryPoints: [`./${main}`],
  outfile: join(output, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  external: ["node:*", "cloudflare:*"],
  // Bake in the public mode so a missing deployment variable cannot enable the local worker proxy.
  define: {
    "process.env.PROOFBOUND_PUBLIC_TESTNET": JSON.stringify(vars.PROOFBOUND_PUBLIC_TESTNET),
    "process.env.PROOFBOUND_PUBLIC_ORIGIN": JSON.stringify(vars.PROOFBOUND_PUBLIC_ORIGIN),
  },
});
await writeFile(join(output, "_routes.json"), JSON.stringify({
  version: 1,
  include: ["/*"],
  exclude: ["/_next/static/*", "/brand/*"],
}));
