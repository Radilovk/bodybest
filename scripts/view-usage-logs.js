#!/usr/bin/env node
import { spawnSync } from 'child_process';

const [type = 'sendTestEmail', limit = '10', binding = 'USER_METADATA_KV'] = process.argv.slice(2);
const prefix = `usage_${type}_`;

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

const list = run('wrangler', ['kv', 'key', 'list', '--binding', binding, '--prefix', prefix]);
if (list.error) {
  console.error('Failed to list keys:', list.error.message);
  process.exit(1);
}
if (list.status !== 0) {
  console.error(`wrangler exited with code ${list.status}`);
  if (list.stderr) {
    console.error(list.stderr.toString());
  }
  process.exit(list.status ?? 1);
}
const keys = JSON.parse(list.stdout || '{}').keys || [];
keys.sort((a, b) => a.name.localeCompare(b.name));
const recent = keys.slice(-parseInt(limit, 10));
for (const k of recent) {
  const get = run('wrangler', ['kv', 'key', 'get', k.name, '--binding', binding]);
  if (get.error) {
    console.error('Failed to get', k.name, get.error.message);
    continue;
  }
  if (get.status !== 0) {
    console.error(`wrangler exited with code ${get.status}`);
    if (get.stderr) {
      console.error(get.stderr.toString());
    }
    continue;
  }
  const val = get.stdout.trim();
  try {
    const obj = JSON.parse(val);
    console.log(`${k.name}:`, obj);
  } catch {
    console.log(`${k.name}:`, val);
  }
}
