import { safeParseFloat, safeGet } from './utils.js';

// Apply saved theme so the page matches the dashboard
(function applySavedTheme() {
  const saved = localStorage.getItem('theme') || 'system';
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = saved === 'system' ? system : saved;
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
})();

const form = document.getElementById('profileEditForm');

if (form) {
  const prefillProfileData = async () => {
    try {
      const res = await fetch('/api/getProfile');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      form.name.value = safeGet(data, 'name', '');
      const age = safeParseFloat(safeGet(data, 'age'));
      if (age !== null && age !== undefined) form.age.value = age;
      const height = safeParseFloat(safeGet(data, 'height'));
      if (height !== null && height !== undefined) form.height.value = height;
    } catch (err) {
      console.warn('Could not load profile data:', err);
    }
  };

  prefillProfileData();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: form.name.value.trim(),
      age: safeParseFloat(form.age.value),
      height: safeParseFloat(form.height.value),
    };
    try {
      const res = await fetch('/api/updateProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Server error');
      alert('Профилът е обновен успешно');
      window.location.href = 'code.html';
    } catch (err) {
      alert('Грешка при обновяване на профила');
      console.error(err);
    }
  });
}
