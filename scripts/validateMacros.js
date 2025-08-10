import fs from 'fs/promises';
import path from 'path';

const THRESHOLD = 0.05;

function calcCalories({ protein = 0, carbs = 0, fat = 0, fiber = 0 }) {
  return protein * 4 + (carbs - fiber) * 4 + fat * 9 + fiber * 2;
}

async function loadJson(file) {
  const content = await fs.readFile(path.resolve(file), 'utf8');
  return JSON.parse(content);
}

async function validateProducts() {
  const products = await loadJson('kv/DIET_RESOURCES/product_macros.json');
  const issues = [];
  const skipped = [];
  for (const p of products) {
    const expected = calcCalories(p);
    const declared = p.calories;
    if (!expected) {
      if (declared) skipped.push({ type: 'product', name: p.name });
      continue;
    }
    const diff = Math.abs(expected - declared) / expected;
    if (diff > THRESHOLD) {
      issues.push({ type: 'product', name: p.name, expected, declared });
    }
  }
  return { issues, skipped };
}

async function validateMeals() {
  const model = await loadJson('kv/DIET_RESOURCES/base_diet_model.json');
  const issues = [];
  const skipped = [];
  for (const meal of model.ястия || []) {
    const m = meal['хранителни_стойности'];
    if (!m) continue;
    const macros = {
      calories: m['калории'],
      protein: m['белтъчини'],
      carbs: m['въглехидрати'],
      fat: m['мазнини'],
    };
    const expected = calcCalories(macros);
    const declared = macros.calories;
    if (!expected) {
      if (declared) skipped.push({ type: 'meal', name: meal.име });
      continue;
    }
    const diff = Math.abs(expected - declared) / expected;
    if (diff > THRESHOLD) {
      issues.push({ type: 'meal', name: meal.име, expected, declared });
    }
  }
  return { issues, skipped };
}

async function main() {
  const products = await validateProducts();
  const meals = await validateMeals();
  const issues = [...products.issues, ...meals.issues];
  const skipped = [...products.skipped, ...meals.skipped];

  if (issues.length) {
    console.error('Macro calorie mismatches (>5%):');
    for (const i of issues) {
      console.error(`- ${i.type} "${i.name}" expected ${i.expected.toFixed(2)} got ${i.declared}`);
    }
  }
  if (skipped.length) {
    console.warn('Skipped entries (missing macro data):');
    for (const s of skipped) {
      console.warn(`- ${s.type} "${s.name}"`);
    }
  }
  if (issues.length) {
    process.exitCode = 1;
  } else {
    console.log('All macros validated');
  }
}

main();
