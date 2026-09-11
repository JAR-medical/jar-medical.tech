// Boots the static server once for the whole run.
//
// The port is ephemeral (bind 0, read back the real port), so parallel runs and
// CI never collide on a hardcoded 8000. Playwright forks its workers after this
// returns, so they inherit E2E_BASE_URL through the environment; the returned
// teardown closes the server even when the run fails.
import { startServer } from './server.mjs';

export default async function globalSetup() {
  const server = await startServer();
  process.env.E2E_BASE_URL = server.url;
  // eslint-disable-next-line no-console
  console.log(`[e2e] serving the repository root at ${server.url}`);
  return async () => {
    await server.close();
  };
}
