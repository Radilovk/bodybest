#!/usr/bin/env node
import { readFile } from 'fs/promises';

const [preworker, worker] = await Promise.all([
  readFile(new URL('../preworker.js', import.meta.url), 'utf8'),
  readFile(new URL('../worker.js', import.meta.url), 'utf8'),
]);

if (preworker !== worker) {
  console.error('Error: worker.js is not synchronized with preworker.js.');
  console.error('Run the build process or copy preworker.js to worker.js.');
  process.exit(1);
}

