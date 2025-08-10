import productMacros from '../../kv/DIET_RESOURCES/product_macros.json' with { type: 'json' };
import productMeasures from '../../kv/DIET_RESOURCES/product_measure.json' with { type: 'json' };

test('има мерки за всеки продукт в макросите', () => {
  const measureMap = Object.fromEntries(
    Object.entries(productMeasures).map(([k, v]) => [k.toLowerCase(), v])
  );
  const missing = productMacros
    .filter(p => {
      const measures = measureMap[(p.name || '').toLowerCase()];
      return !Array.isArray(measures) || measures.length === 0;
    })
    .map(p => p.name);
  expect(missing).toEqual([]);
});
