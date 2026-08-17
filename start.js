#!/usr/bin/env node
/**
 * Starts the WinGames dev server and opens it in your browser.
 *
 *   node start.js          (or: npm start)
 *
 * Tries port 3000 first; if that's taken, Vite automatically walks up to the
 * next free port (3001, 3002, ...) and we report whichever one it lands on.
 *
 * Stop it with Ctrl+C.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const START_PORT = 3000;

if (!existsSync(join(root, 'node_modules', 'vite'))) {
  console.error('Dependencies are not installed yet.\n\n  Run: npm install\n');
  process.exit(1);
}

const running = await findRunningInstance(START_PORT);
if (running) {
  console.log(`\n  A server is already running — open ${running}\n`);
  console.log('  If that is not WinGames, stop the other process and run this again.\n');
  process.exit(0);
}

const { createServer } = await import('vite');

// strictPort: false (Vite's default) overrides the strictPort: true in
// vite.config.ts for this entry point only, so `npm run dev` and the
// Playwright suite keep their fixed port while a manual start slides up to
// the next free one instead of erroring out.
const server = await createServer({
  root,
  configFile: join(root, 'vite.config.ts'),
  server: { port: START_PORT, strictPort: false, open: true },
});

await server.listen();

const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}/`;

console.log('\n  WinGames — Klondike · Spider · FreeCell');
console.log(`  Playing at ${url}`);
console.log('  Press Ctrl+C to stop.\n');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}

/**
 * Looks for a WinGames instance already running near the start port — the
 * common case of running this script twice — and returns its URL, or null.
 * Checked by page title rather than just "something answered", so an
 * unrelated app sitting on one of these ports isn't mistaken for ours; Vite's
 * own auto-increment (not this scan) is what actually finds a free port.
 *
 * An HTTP probe rather than a port bind: the dev server may be listening on
 * ::1 while a bind test on 127.0.0.1 happily succeeds, which would miss it.
 */
async function findRunningInstance(startPort, span = 20) {
  for (let port = startPort; port < startPort + span; port++) {
    const url = `http://localhost:${port}/`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(700) });
      if (res.ok && (await res.text()).includes('WinGames')) return url;
    } catch {
      // Nothing listening here — keep scanning.
    }
  }
  return null;
}
