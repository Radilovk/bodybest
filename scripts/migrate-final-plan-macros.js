import { spawnSync } from 'child_process';

function calcMacroGrams(calories, percent, calsPerGram) {
  const cal = Number(calories);
  const pct = Number(percent);
  if (!cal || !pct) return 0;
  return Math.round((cal * pct) / 100 / calsPerGram);
}

function estimateMacros(initial = {}) {
  const weight = Number(initial.weight);
  const height = Number(initial.height);
  const age = Number(initial.age);
  if (!weight || !height || !age) return null;
  const gender = (initial.gender || '').toLowerCase().startsWith('м') ? 'male' : 'female';
  const activity = (initial.q1745878295708 || '').toLowerCase();
  const activityFactors = {
    'ниско': 1.2,
    'sedentary': 1.2,
    'седящ': 1.2,
    'средно': 1.375,
    'умерено': 1.375,
    'високо': 1.55,
    'активно': 1.55,
    'много високо': 1.725
  };
  const factor = activityFactors[activity] || 1.375;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const calories = Math.round(bmr * factor);
  const protein_percent = 30;
  const carbs_percent = 40;
  const fat_percent = 30;
  const protein_grams = calcMacroGrams(calories, protein_percent, 4);
  const carbs_grams = calcMacroGrams(calories, carbs_percent, 4);
  const fat_grams = calcMacroGrams(calories, fat_percent, 9);
  return { calories, protein_percent, carbs_percent, fat_percent, protein_grams, carbs_grams, fat_grams };
}

function runWrangler(args) {
  const result = spawnSync('wrangler', args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function migrate() {
  const binding = 'USER_METADATA_KV';
  const listJson = runWrangler(['kv', 'key', 'list', '--binding', binding]);
  const keys = JSON.parse(listJson).map(k => k.name).filter(k => k.endsWith('_final_plan'));
  keys.forEach(key => {
    const userId = key.replace('_final_plan', '');
    const planStr = runWrangler(['kv', 'key', 'get', key, '--binding', binding]);
    let plan;
    try { plan = JSON.parse(planStr || '{}'); } catch { plan = {}; }
    if (!plan.caloriesMacros || Object.keys(plan.caloriesMacros).length === 0) {
      let macrosStr;
      try {
        macrosStr = runWrangler(['kv', 'key', 'get', `${userId}_final_caloriesMacros`, '--binding', binding]);
      } catch {
        macrosStr = null;
      }
      let macros;
      try { macros = JSON.parse(macrosStr || 'null'); } catch { macros = null; }
      if (!macros) {
        const initStr = runWrangler(['kv', 'key', 'get', `${userId}_initial_answers`, '--binding', binding]);
        let initial;
        try { initial = JSON.parse(initStr || '{}'); } catch { initial = {}; }
        macros = estimateMacros(initial);
        if (!macros) {
          console.warn(`Skipping ${userId}: unable to compute macros`);
          return;
        }
      }
      plan.caloriesMacros = macros;
      runWrangler(['kv', 'key', 'put', key, JSON.stringify(plan), '--binding', binding]);
      console.log(`Updated ${key}`);
    }
    try {
      runWrangler(['kv', 'key', 'delete', `${userId}_final_caloriesMacros`, '--binding', binding]);
    } catch {
      /* noop */
    }
  });
}

migrate();
