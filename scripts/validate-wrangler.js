import fs from 'fs';

try {
  const toml = fs.readFileSync('wrangler.toml', 'utf8');
  if (/00000000000000000000000000000000/.test(toml)) {
    console.error('wrangler.toml съдържа стойности placeholder за KV namespace. Заменете ги с реални ID.');
    process.exit(1);
  }

  if (!process.env.CF_API_TOKEN) {
    console.error('Липсва променливата на средата CF_API_TOKEN.');
    process.exit(1);
  }

  console.log('Конфигурацията изглежда валидна.');
} catch (err) {
  console.error('Грешка при проверка на wrangler.toml:', err.message);
  process.exit(1);
}
