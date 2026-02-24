import { spawn } from 'node:child_process'

const requiredVars = ['INTERCOM_API_KEY']
const missing = requiredVars.filter((name) => {
  const value = process.env[name]
  return typeof value !== 'string' || value.trim() === ''
})

if (missing.length > 0) {
  console.error('\n[local-api] Missing required environment variables:')
  for (const name of missing) {
    console.error(`- ${name}`)
  }
  console.error('\nSet them and retry. Example:')
  console.error('  export INTERCOM_API_KEY="your-intercom-token"')
  console.error('  npm run api:local\n')
  process.exit(1)
}

const child = spawn('node', ['server.mjs'], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
