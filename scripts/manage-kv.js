#!/usr/bin/env node
import { spawnSync } from 'child_process';

const [action, key, value, binding = 'RESOURCES_KV'] = process.argv.slice(2);

if (!['get', 'put', 'delete'].includes(action) || !key || (action === 'put' && !value)) {
  console.log('Usage: node scripts/manage-kv.js <get|put|delete> <key> [value] [binding]');
  process.exit(1);
}

const args = ['kv:key', action, key];
if (action === 'put') args.push(value);
args.push('--binding', binding);

// Използваме `npx`, за да работи без глобална инсталация на wrangler
const result = spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit' });

if (result.error) {
  console.error('Failed to run wrangler:', result.error);
  process.exit(1);
}
