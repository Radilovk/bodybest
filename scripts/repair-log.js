#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { jsonrepair } from 'jsonrepair';

const [userId, date, binding = 'USER_METADATA_KV'] = process.argv.slice(2);

if (!userId || !date) {
  console.log('Usage: node scripts/repair-log.js <userId> <YYYY-MM-DD> [binding]');
  process.exit(1);
}

const key = `${userId}_log_${date}`;

function runWrangler(args, options = {}) {
  return spawnSync('wrangler', args, { encoding: 'utf8', ...options });
}

const getRes = runWrangler(['kv', 'key', 'get', key, '--binding', binding]);
if (getRes.error) {
  console.error('Failed to run wrangler:', getRes.error);
  process.exit(1);
}
if (getRes.status !== 0) {
  console.error(`wrangler exited with code ${getRes.status}`);
  if (getRes.stderr) {
    console.error(getRes.stderr.toString());
  }
  process.exit(getRes.status ?? 1);
}
const value = (getRes.stdout || '').trim();
if (!value) {
  console.log(`Key ${key} not found or empty.`);
  process.exit(0);
}

try {
  JSON.parse(value);
  console.log('JSON is valid. No repair needed.');
} catch (e) {
  console.warn(`Invalid JSON detected: ${e.message}. Attempting repair...`);
  try {
    const repaired = jsonrepair(value);
    JSON.parse(repaired);
    const putRes = runWrangler(
      ['kv', 'key', 'put', key, repaired, '--binding', binding],
      { stdio: ['inherit', 'inherit', 'pipe'] }
    );
    if (putRes.error) {
      console.error('Failed to put repaired value:', putRes.error);
      process.exit(1);
    }
    if (putRes.status !== 0) {
      console.error(`wrangler exited with code ${putRes.status}`);
      if (putRes.stderr) {
        console.error(putRes.stderr.toString());
      }
      process.exit(putRes.status ?? 1);
    }
    console.log('Value repaired and updated.');
  } catch (err) {
    console.error('Failed to repair JSON:', err.message);
    process.exit(1);
  }
}

