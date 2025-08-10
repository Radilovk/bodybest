import fs from 'fs/promises';
import path from 'path';

async function validateFile(file) {
  try {
    const data = await fs.readFile(path.resolve(file), 'utf8');
    JSON.parse(data);
    console.log(`✓ ${file}`);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    files.push('kv/DIET_RESOURCES/product_macros.json');
  }
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await validateFile(file);
  }
  if (process.exitCode) {
    process.exit(1);
  }
}

main();
