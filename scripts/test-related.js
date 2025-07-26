#!/usr/bin/env node
import { spawnSync } from 'child_process';

function getChangedFiles() {
  const diff = spawnSync('git', ['diff', '--name-only', '--cached'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    console.error(diff.stderr);
    process.exit(diff.status ?? 1);
  }
  return diff.stdout
    .split('\n')
    .filter((f) => f.endsWith('.js') || f.endsWith('.ts'))
    .filter(Boolean);
}

const changed = getChangedFiles();

if (changed.length === 0) {
  console.log('No staged JS/TS files found. Running full test suite...');
  const full = spawnSync('sh', ['scripts/test.sh'], { stdio: 'inherit' });
  process.exit(full.status ?? 0);
}

const args = ['scripts/test.sh', '--findRelatedTests', ...changed];
const result = spawnSync('sh', args, { stdio: 'inherit' });
process.exit(result.status ?? 0);
