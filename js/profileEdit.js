import { safeParseFloat, safeGet } from './utils.js';

const form = document.getElementById('profileEditForm');

if (form) {
  const prefillProfileData = async () => {
    try {
      const res = await fetch('/api/getProfile');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      form.name.value = safeGet(data, 'name', '');
      const weight = safeParseFloat(safeGet(data, 'weight'));
      if (weight !== null && weight !== undefined) form.weight.value = weight;
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
      weight: safeParseFloat(form.weight.value),
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
