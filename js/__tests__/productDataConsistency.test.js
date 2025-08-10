import productMeasures from '../../kv/DIET_RESOURCES/product_measure.json' with { type: 'json' };
import productMacros from '../../kv/DIET_RESOURCES/product_macros.json' with { type: 'json' };

test('наборите от имена в product_measure.json и product_macros.json съвпадат', () => {
  const measureNames = new Set((productMeasures || []).map(p => p.name.toLowerCase()));
  const macroNames = new Set((productMacros || []).map(p => p.name.toLowerCase()));

  const missingInMacros = [...measureNames].filter(n => !macroNames.has(n));
  const missingInMeasures = [...macroNames].filter(n => !measureNames.has(n));

  const messages = [];
  if (missingInMacros.length) {
    messages.push(`Липсват в product_macros.json: ${missingInMacros.join(', ')}`);
  }
  if (missingInMeasures.length) {
    messages.push(`Липсват в product_measure.json: ${missingInMeasures.join(', ')}`);
  }

  if (messages.length) {
    throw new Error(messages.join('\n'));
  }
});
