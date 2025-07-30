import { safeParseFloat, safeGet } from './utils.js';
import { currentUserId } from './app.js';
import { apiEndpoints } from './config.js';

// Apply saved theme so the page matches the dashboard
(function applySavedTheme() {
  const saved = localStorage.getItem('theme') || 'system';
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let theme = saved === 'system' ? system : saved;
  if (!['light', 'dark', 'vivid'].includes(theme)) theme = 'light';
  document.body.classList.remove('light-theme', 'dark-theme', 'vivid-theme');
  document.body.classList.add(theme === 'dark' ? 'dark-theme' : theme === 'vivid' ? 'vivid-theme' : 'light-theme');
})();

const form = document.getElementById('profileEditForm');

if (form) {
  const prefillProfileData = async () => {
    try {
      const res = await fetch(`${apiEndpoints.getProfile}?userId=${currentUserId}`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();

      form.name.value = safeGet(data, 'name', '');
      form.fullname.value = safeGet(data, 'fullname', '');

      const age = safeParseFloat(safeGet(data, 'age'));
      if (age !== null && age !== undefined) form.age.value = age;

      form.phone.value = safeGet(data, 'phone', '');
      form.email.value = safeGet(data, 'email', '');

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
      fullname: form.fullname.value.trim(),
      age: safeParseFloat(form.age.value),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      height: safeParseFloat(form.height.value),
    };

    try {
      await fetch(apiEndpoints.updateProfile, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId: currentUserId }),
      });
      alert('Профилът е обновен успешно');
      window.location.href = 'code.html';
    } catch (err) {
      alert('Грешка при обновяване на профила');
      console.error(err);
    }
  });
}
