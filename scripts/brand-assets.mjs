import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const directory = new URL("../apps/web/", import.meta.url);
const svg = await readFile(new URL("public/brand/mark.svg", directory));
const render = size => sharp(svg, { density: 288 })
  .resize(size, size)
  .png()
  .toBuffer();

const appFile = name => new URL(`src/app/${name}`, directory);
const publicFile = name => new URL(`public/brand/${name}`, directory);
const [small, medium, large] = await Promise.all([16, 32, 48].map(render));
const frames = [[16, small], [32, medium], [48, large]];
const index = Buffer.alloc(6 + frames.length * 16);
index.writeUInt16LE(1, 2); // ICO type
index.writeUInt16LE(frames.length, 4);
let offset = index.length;
frames.forEach(([size, png], i) => {
  const entry = 6 + i * 16;
  index[entry] = size;
  index[entry + 1] = size;
  index.writeUInt16LE(1, entry + 4);
  index.writeUInt16LE(32, entry + 6);
  index.writeUInt32LE(png.length, entry + 8);
  index.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});

const [apple, icon192, icon512] = await Promise.all([
  sharp(svg, { density: 288 }).resize(180, 180).flatten({ background: "#103e34" }).png().toBuffer(),
  render(192),
  render(512),
]);
await Promise.all([
  writeFile(appFile("favicon.ico"), Buffer.concat([index, ...frames.map(([, png]) => png)])),
  writeFile(appFile("icon.svg"), svg),
  writeFile(appFile("apple-icon.png"), apple),
  writeFile(publicFile("favicon-16.png"), small),
  writeFile(publicFile("favicon-32.png"), medium),
  writeFile(publicFile("icon-192.png"), icon192),
  writeFile(publicFile("icon-512.png"), icon512),
]);
