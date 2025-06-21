export async function loadTemplateInto(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    container.innerHTML = await resp.text();
  } catch (err) {
    console.error('Template load error:', err);
  }
}
