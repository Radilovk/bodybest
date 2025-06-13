import fs from 'fs';

const { USER_METADATA_KV_ID, USER_METADATA_KV_PREVIEW_ID } = process.env;

if (USER_METADATA_KV_ID && USER_METADATA_KV_PREVIEW_ID) {
  try {
    let toml = fs.readFileSync('wrangler.toml', 'utf8');
    toml = toml.replace('${USER_METADATA_KV_ID}', USER_METADATA_KV_ID)
               .replace('${USER_METADATA_KV_PREVIEW_ID}', USER_METADATA_KV_PREVIEW_ID);
    fs.writeFileSync('wrangler.toml', toml);
    console.log('wrangler.toml updated with KV namespace IDs from environment');
  } catch (err) {
    console.error('Failed to update wrangler.toml:', err.message);
    process.exit(1);
  }
} else {
  console.log('KV ID environment variables not provided; using existing values');
}
