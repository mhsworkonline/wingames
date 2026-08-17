#!/usr/bin/env node
/**
 * Pushes the current branch to GitHub.
 *
 *   node deploy.js                  commit any changes, then push
 *   node deploy.js "commit message" commit with this message, then push
 */
import { execFileSync } from 'node:child_process';

const message = process.argv[2] || `Update WinGames — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const branch = git(['branch', '--show-current']);
if (!branch) {
  console.error('Detached HEAD — check out a branch first.');
  process.exit(1);
}

if (git(['status', '--porcelain'])) {
  git(['add', '-A']);
  execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });
} else {
  console.log('No local changes to commit.');
}

console.log(`\nPushing ${branch} to origin...`);
execFileSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' });

console.log(`\nDone. Commit: ${git(['rev-parse', '--short', 'HEAD'])}`);
