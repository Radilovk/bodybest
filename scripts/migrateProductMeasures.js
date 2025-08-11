import fs from 'node:fs/promises';

/**
 * Преобразува стария формат на product_measure.json, при който
 * синонимите са отделни записи, към новия формат с поле "aliases".
 *
 * Използване:
 *   node scripts/migrateProductMeasures.js [src] [dest]
 * Ако не се подадат аргументи, използва по подразбиране
 * kv/DIET_RESOURCES/product_measure.json и записва резултата
 * в kv/DIET_RESOURCES/product_measure.migrated.json.
 */
async function migrate(src, dest) {
  const raw = JSON.parse(await fs.readFile(src, 'utf8'));
  const groups = new Map();
  for (const p of raw) {
    const key = JSON.stringify({ category: p.category, measures: p.measures });
    if (!groups.has(key)) {
      groups.set(key, { name: p.name, category: p.category, measures: p.measures, aliases: [] });
    } else {
      groups.get(key).aliases.push(p.name);
    }
  }
  const result = [...groups.values()].map(p => ({ ...p, aliases: [...new Set(p.aliases)] }));
  await fs.writeFile(dest, JSON.stringify(result, null, 2));
}

const [ , , src = 'kv/DIET_RESOURCES/product_measure.json', dest = 'kv/DIET_RESOURCES/product_measure.migrated.json' ] = process.argv;

migrate(src, dest).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
