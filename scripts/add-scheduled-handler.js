/**
 * Post-build script: wraps the OpenNext worker with a Cloudflare Cron Trigger
 * `scheduled` handler that calls the /api/sync endpoint.
 *
 * OpenNext generates `.open-next/worker.js` which only exports a `fetch` handler.
 * Cloudflare Cron Triggers require a `scheduled` export. This script renames the
 * original worker and creates a wrapper that re-exports `fetch` and adds `scheduled`.
 */

const { readFileSync, writeFileSync, renameSync, existsSync } = require("fs");
const { resolve } = require("path");

const workerPath = resolve(__dirname, "../.open-next/worker.js");
const originalWorkerPath = resolve(__dirname, "../.open-next/worker-original.js");

if (!existsSync(workerPath)) {
  console.error("Error: .open-next/worker.js not found. Run the OpenNext build first.");
  process.exit(1);
}

// Read the original worker to check if it's already been patched
const workerContent = readFileSync(workerPath, "utf-8");
if (workerContent.includes("// SCHEDULED_HANDLER_PATCHED")) {
  console.log("Worker already patched with scheduled handler, skipping.");
  process.exit(0);
}

// Rename original worker
renameSync(workerPath, originalWorkerPath);

// Create wrapper that re-exports the original and adds the scheduled handler
const wrapper = `// SCHEDULED_HANDLER_PATCHED
import originalWorker from "./worker-original.js";

export default {
  // Delegate all fetch requests to the original OpenNext worker
  fetch: originalWorker.fetch,

  // Cloudflare Cron Trigger handler — calls /api/sync to sync prices from Elering
  async scheduled(controller, env, ctx) {
    const url = "http://localhost/api/sync";
    console.log(\`[Cron] Triggered at \${new Date(controller.scheduledTime).toISOString()}, calling \${url}\`);

    try {
      const request = new Request(url, { method: "POST" });
      const response = await originalWorker.fetch(request, env, ctx);
      const body = await response.text();
      console.log(\`[Cron] Sync response (\${response.status}): \${body}\`);

      if (!response.ok) {
        throw new Error(\`Sync failed with HTTP \${response.status}: \${body}\`);
      }
    } catch (error) {
      console.error("[Cron] Sync error:", error);
      throw error;
    }
  },
};
`;

writeFileSync(workerPath, wrapper, "utf-8");
console.log("Patched .open-next/worker.js with scheduled handler for Cron Triggers.");
