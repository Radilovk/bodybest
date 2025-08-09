import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const dir = process.argv[2] || path.resolve('kv/DIET_RESOURCES')
const binding = process.argv[3] || 'RESOURCES_KV'

if (!fs.existsSync(dir)) {
  console.error(`Directory not found: ${dir}`)
  process.exit(1)
}

for (const file of fs.readdirSync(dir)) {
  const filePath = path.join(dir, file)
  if (fs.statSync(filePath).isFile()) {
    const key = path.basename(file, path.extname(file))
    const value = fs.readFileSync(filePath, 'utf8')
    console.log(`Uploading ${key}...`)
    const result = spawnSync('wrangler', ['kv', 'key', 'put', key, value, '--binding', binding], {
      encoding: 'utf8',
      stdio: 'inherit'
    })
    if (result.status !== 0) {
      console.error(`Failed to upload ${key}`)
      process.exit(result.status ?? 1)
    }
  }
}

console.log('KV sync complete.')
