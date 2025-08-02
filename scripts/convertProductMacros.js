import fs from 'fs/promises';
import path from 'path';

async function convert() {
  const txtPath = path.resolve('kv/DIET_RESOURCES/product_macros.txt');
  const jsonPath = path.resolve('kv/DIET_RESOURCES/product_macros.json');
  const content = await fs.readFile(txtPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const products = [];
  let category = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[IVXL]+\./.test(trimmed)) {
      category = trimmed.replace(/^[IVXL]+\.\s*/, '').trim();
      continue;
    }
    if (/^Стойностите|^Изчерпателен|^Храна/.test(trimmed)) continue;
    const match = trimmed.match(/(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (match) {
      const [, name, calories, protein, carbs, fiber, fat] = match;
      let rawName = name;
      if (rawName.includes(':')) {
        const [prefix, rest] = rawName.split(':').map(s => s.trim());
        const lowerPrefix = prefix.toLowerCase();
        const dropPrefix = rest.toLowerCase().includes(lowerPrefix) ||
          ['птиче', 'субпродукти', 'риба'].includes(lowerPrefix);
        rawName = dropPrefix ? rest : `${prefix} ${rest}`;
      }
      rawName = rawName.replace(/\s+/g, ' ').trim();
      products.push({
        name: rawName.toLowerCase(),
        calories: Number(calories),
        protein: Number(protein),
        carbs: Number(carbs),
        fat: Number(fat),
        fiber: Number(fiber),
        category
      });
    }
  }
  await fs.writeFile(jsonPath, JSON.stringify(products, null, 2));
}

convert();
