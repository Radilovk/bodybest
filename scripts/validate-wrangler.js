import fs from 'fs';

try {
  const toml = fs.readFileSync('wrangler.toml', 'utf8');

  if (/\$\{USER_METADATA_KV_ID\}/.test(toml) || /\$\{USER_METADATA_KV_PREVIEW_ID\}/.test(toml)) {
    if (!process.env.USER_METADATA_KV_ID || !process.env.USER_METADATA_KV_PREVIEW_ID) {
      console.error('Липсват USER_METADATA_KV_ID или USER_METADATA_KV_PREVIEW_ID като променливи на средата.');
      process.exit(1);
    }
  }

  if (/00000000000000000000000000000000/.test(toml)) {
    console.error('wrangler.toml съдържа стойности placeholder за KV namespace. Заменете ги с реални ID или използвайте env променливи.');
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
