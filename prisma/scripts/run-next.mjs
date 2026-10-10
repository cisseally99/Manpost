import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!command || !["dev", "start"].includes(command)) {
  console.error("Usage: node scripts/run-next.mjs <dev|start> [Next.js arguments]");
  process.exit(1);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 19)) {
  console.error("Manpost's local server requires Node.js 22.19 or newer to use the system certificate store safely.");
  process.exit(1);
}

const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [nextCli, command, ...process.argv.slice(3)], {
  stdio: "inherit",
  env: { ...process.env, NODE_USE_SYSTEM_CA: "1" },
});

child.on("error", (error) => {
  console.error("Could not start Next.js:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
