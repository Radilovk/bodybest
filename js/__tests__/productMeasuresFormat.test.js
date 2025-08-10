import productMeasures from '../../kv/DIET_RESOURCES/product_measure.json' with { type: 'json' };

test('всеки запис има име и поне една мерна единица', () => {
  const invalid = (productMeasures || []).filter(
    p => typeof p.name !== 'string' || !Array.isArray(p.measures) || p.measures.length === 0
  );
  expect(invalid).toEqual([]);
});
