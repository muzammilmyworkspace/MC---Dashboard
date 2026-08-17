import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { initRealtime } from "./realtime/io.js";
import { disconnectDb, prisma } from "./lib/prisma.js";
import { startSyncScheduler, stopSyncScheduler } from "./services/deployments/sync.js";
import { startInstagramScheduler, stopInstagramScheduler } from "./services/instagram/sync.js";
import { assertNoPublicSecrets } from "./services/integrations/meta-config.js";
import { assertNoDuplicateEnvKeys } from "./lib/env-audit.js";

assertNoDuplicateEnvKeys();
assertNoPublicSecrets();

const app = createApp();
const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`\n  MC Nexus API  ·  http://localhost:${env.PORT}`);
  console.log(`  health        ·  http://localhost:${env.PORT}/health`);
  console.log(`  env           ·  ${env.NODE_ENV}\n`);

  startSyncScheduler();
  startInstagramScheduler();

  prisma
    .$queryRaw`SELECT 1`
    .then(() => console.log("  ✔ database connected\n"))
    .catch(() =>
      console.warn(
        "  ⚠ database unreachable — start PostgreSQL (docker compose up -d) then run `npm run setup`\n"
      )
    );
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down…`);
  stopSyncScheduler();
  stopInstagramScheduler();
  server.close();
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
