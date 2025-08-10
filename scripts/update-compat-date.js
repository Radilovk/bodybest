import fs from 'fs';
import { getLocalDate } from '../js/utils.js';

const today = getLocalDate();

let toml;
try {
  toml = fs.readFileSync('wrangler.toml', 'utf8');
} catch (err) {
  console.error('Cannot read wrangler.toml:', err.message);
  process.exit(1);
}

const match = toml.match(/compatibility_date\s*=\s*"(\d{4}-\d{2}-\d{2})"/);
if (!match) {
  console.error('compatibility_date not found in wrangler.toml');
  process.exit(1);
}

const [, current] = match;
if (current > today) {
  const updated = toml.replace(match[0], `compatibility_date = "${today}"`);
  fs.writeFileSync('wrangler.toml', updated);
  console.log(`compatibility_date updated to ${today}`);
} else {
  console.log('compatibility_date is valid');
}
