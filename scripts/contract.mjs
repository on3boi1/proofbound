import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tasks = {
  test: ["test"],
  build: ["build", "--target", "wasm32-unknown-unknown", "--release"],
};
const task = process.argv[2];
if (!Object.hasOwn(tasks, task)) throw new Error("Choose contract build or test.");
const args = [...tasks[task], "--locked", "--manifest-path", "contracts/proofbound/Cargo.toml"];
const cwd = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const result = windows
  ? spawnSync("cmd.exe", ["/d", "/c", "scripts\\contract.cmd", ...args], { cwd, stdio: "inherit" })
  : spawnSync("cargo", args, { cwd, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
