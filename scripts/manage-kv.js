import { spawnSync } from 'child_process';

const [action, key, value, binding = 'RESOURCES_KV'] = process.argv.slice(2);

if (!['get', 'put', 'delete'].includes(action) || !key || (action === 'put' && !value)) {
  console.log('Usage: node scripts/manage-kv.js <get|put|delete> <key> [value] [binding]');
  process.exit(1);
}

const args = ['kv', 'key', action, key];
if (action === 'put') args.push(value);
args.push('--binding', binding);

const result = spawnSync('wrangler', args, { encoding: 'utf8', stdio: ['inherit', 'inherit', 'pipe'] });

if (result.error) {
  console.error('Failed to run wrangler:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`wrangler exited with code ${result.status}`);
  if (result.stderr) {
    console.error(result.stderr.toString());
  }
  process.exit(result.status ?? 1);
}
