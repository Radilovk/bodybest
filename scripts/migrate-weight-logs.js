#!/usr/bin/env node
import { spawnSync } from 'child_process';

const [binding = 'USER_METADATA_KV'] = process.argv.slice(2);

function runWrangler(args) {
  return spawnSync('wrangler', args, { encoding: 'utf8' });
}

const listRes = runWrangler(['kv', 'key', 'list', '--binding', binding]);
if (listRes.error) {
  console.error('Failed to list keys:', listRes.error.message);
  process.exit(1);
}
if (listRes.status !== 0) {
  console.error(`wrangler exited with code ${listRes.status}`);
  if (listRes.stderr) {
    console.error(listRes.stderr.toString());
  }
  process.exit(listRes.status ?? 1);
}

let keys;
try {
  keys = JSON.parse(listRes.stdout || '{}').keys || [];
} catch (err) {
  console.error('Failed to parse key list:', err.message);
  process.exit(1);
}

for (const { name } of keys) {
  if (!/_log_/i.test(name)) continue;
  const getRes = runWrangler(['kv', 'key', 'get', name, '--binding', binding]);
  if (getRes.error) {
    console.error('Failed to get', name, getRes.error.message);
    continue;
  }
  if (getRes.status !== 0) {
    console.error(`wrangler exited with code ${getRes.status} for key ${name}`);
    if (getRes.stderr) {
      console.error(getRes.stderr.toString());
    }
    continue;
  }
  const raw = (getRes.stdout || '').trim();
  if (!raw) continue;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    console.warn(`Skipping ${name}: invalid JSON`);
    continue;
  }
  const hasTopWeight = obj.weight !== undefined;
  if (!obj.data) obj.data = {};
  const needsUpdate = obj.data.weight === undefined && hasTopWeight;
  if (!needsUpdate) continue;
  obj.data.weight = obj.weight;
  const putRes = runWrangler(['kv', 'key', 'put', name, JSON.stringify(obj), '--binding', binding]);
  if (putRes.error) {
    console.error('Failed to update', name, putRes.error.message);
    continue;
  }
  if (putRes.status !== 0) {
    console.error(`wrangler exited with code ${putRes.status} for key ${name}`);
    if (putRes.stderr) {
      console.error(putRes.stderr.toString());
    }
    continue;
  }
  console.log(`Updated ${name}`);
}
