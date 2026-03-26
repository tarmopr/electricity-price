/**
 * Post-build script: injects a Cloudflare Cron Trigger `scheduled` handler
 * into the OpenNext worker.
 *
 * OpenNext generates `.open-next/worker.js` with:
 *   export default { async fetch(request, env, ctx) { ... } };
 *
 * Cloudflare Cron Triggers require a `scheduled` export on the same object.
 * This script modifies the worker in-place:
 *   1. Replaces `export default {` with `const __worker = {`
 *   2. Injects the `scheduled` method into the object
 *   3. Adds `export default __worker;` at the end
 *
 * This approach avoids the import/re-export issues that occur when wrapping
 * with a separate file (wrangler's bundler can't resolve the re-import).
 */

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const workerPath = resolve(__dirname, "../.open-next/worker.js");

if (!existsSync(workerPath)) {
  console.error(
    "Error: .open-next/worker.js not found. Run the OpenNext build first."
  );
  process.exit(1);
}

let content = readFileSync(workerPath, "utf-8");

if (content.includes("// SCHEDULED_HANDLER_PATCHED")) {
  console.log("Worker already patched with scheduled handler, skipping.");
  process.exit(0);
}

// Step 1: Replace `export default {` with `const __worker = {`
// This lets the scheduled handler reference __worker.fetch directly.
if (!content.includes("export default {")) {
  console.error("Error: Could not find `export default {` in worker.js");
  process.exit(1);
}
content = content.replace("export default {", "const __worker = {");

// Step 2: Find the last `};` which closes the worker object literal
const lastClosingIndex = content.lastIndexOf("};");
if (lastClosingIndex === -1) {
  console.error("Error: Could not find closing `};` in worker.js");
  process.exit(1);
}

// Step 3: Inject the scheduled handler before the closing `};`
const scheduledHandler = `    async scheduled(controller, env, ctx) {
        const url = "http://localhost/api/sync";
        console.log(\`[Cron] Triggered at \${new Date(controller.scheduledTime).toISOString()}, calling \${url}\`);
        try {
            const headers = {};
            if (env.SYNC_SECRET) {
                headers["Authorization"] = \`Bearer \${env.SYNC_SECRET}\`;
            }
            const request = new Request(url, { method: "POST", headers });
            const response = await __worker.fetch(request, env, ctx);
            const body = await response.text();
            console.log(\`[Cron] Sync response (\${response.status}): \${body}\`);
            if (!response.ok) {
                throw new Error(\`Sync failed with HTTP \${response.status}: \${body}\`);
            }
        } catch (error) {
            console.error("[Cron] Sync error:", error);
            throw error;
        }
    },`;

const patched =
  "// SCHEDULED_HANDLER_PATCHED\n" +
  content.slice(0, lastClosingIndex) +
  scheduledHandler +
  "\n};\nexport default __worker;\n";

writeFileSync(workerPath, patched, "utf-8");
console.log("Patched .open-next/worker.js with scheduled handler for Cron Triggers.");
