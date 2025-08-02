const cache = {};

export async function loadLocale(lng) {
  if (cache[lng]) return cache[lng];
  try {
    const url = new URL(`../locales/macroCard.${lng}.json`, import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache[lng] = await res.json();
    return cache[lng];
  } catch {
    if (lng !== 'bg') {
      if (!cache.bg) {
        try {
          const url = new URL(`../locales/macroCard.bg.json`, import.meta.url);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          cache.bg = await res.json();
        } catch {
          cache.bg = {};
        }
      }
      if (Object.keys(cache.bg).length) {
        cache[lng] = cache.bg;
        return cache.bg;
      }
    }
    console.warn(`Failed to load locale "${lng}"`);
    cache[lng] = {};
    return cache[lng];
  }
}
