const cache = {};
export async function loadLocale(lng) {
  if (cache[lng]) return cache[lng];
  const res = await fetch(`./locales/macroCard.${lng}.json`);
  cache[lng] = res.ok ? await res.json() : await loadLocale('bg');
  return cache[lng];
}
