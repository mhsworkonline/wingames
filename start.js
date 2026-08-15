#!/usr/bin/env node
/**
 * Starts the WinGames dev server and opens it in your browser.
 *
 *   node start.js          (or: npm start)
 *
 * Stop it with Ctrl+C.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 5173;
const URL = `http://localhost:${PORT}/`;

if (!existsSync(join(root, 'node_modules', 'vite'))) {
  console.error('Dependencies are not installed yet.\n\n  Run: npm install\n');
  process.exit(1);
}

if (await alreadyServing(URL)) {
  console.log(`\n  A server is already running — open ${URL}\n`);
  console.log('  If that is not WinGames, stop the other process and run this again.\n');
  process.exit(0);
}

const { createServer } = await import('vite');

const server = await createServer({
  root,
  configFile: join(root, 'vite.config.ts'),
  server: { port: PORT, open: true },
});

try {
  await server.listen();
} catch (err) {
  if (String(err.message).includes('already in use')) {
    console.error(`\n  Port ${PORT} is already in use. Stop that process, then run this again.\n`);
    process.exit(1);
  }
  throw err;
}

console.log('\n  WinGames — Klondike · Spider · FreeCell');
console.log(`  Playing at ${URL}`);
console.log('  Press Ctrl+C to stop.\n');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}

/**
 * True when something already answers on the URL. An HTTP probe rather than a
 * port bind: the dev server may be listening on ::1 while a bind test on
 * 127.0.0.1 happily succeeds, which would report the port as free.
 */
async function alreadyServing(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}
